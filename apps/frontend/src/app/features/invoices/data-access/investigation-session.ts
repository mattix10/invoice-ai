import { HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Injectable,
  DestroyRef,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { catchError, combineLatest, map, of, startWith, Subject, switchMap, takeUntil } from 'rxjs';
import type { Observable } from 'rxjs';
import type { CopilotAnswer, ReconciliationRead } from '../../../core/api/schema';
import { InvoiceApi } from './invoice-api';
import { resolveEvidence } from './evidence-resolver';
import type { ConversationTurn } from './conversation-turn';

interface InvestigationRoute {
  id: string;
  revision: string | null;
  line: string | null;
}

@Injectable()
export class InvestigationSession {
  private readonly api = inject(InvoiceApi);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly retry = new Subject<void>();
  private readonly questions = new Subject<{ id: number; question: string }>();
  private readonly cancelQuestion = new Subject<void>();
  private nextTurnId = 0;
  readonly turns = signal<readonly ConversationTurn[]>([]);
  readonly invoiceId = signal('');
  readonly selectedRevision = signal(false);
  readonly result = signal<ReconciliationRead | null>(null);
  readonly state = signal<'loading' | 'ready' | 'error'>('loading');
  readonly reconciliationMissing = signal(false);
  readonly answerState = computed(() => this.turns().at(-1)?.state ?? 'idle');

  constructor() {
    const routeState = combineLatest([this.route.paramMap, this.route.queryParamMap]).pipe(
      map(([params, query]): InvestigationRoute => ({
        id: params.get('id') ?? '',
        revision: query.get('revision'),
        line: query.get('line'),
      })),
    );

    this.observeReconciliation(routeState);
    this.observeQuestions(routeState);
  }

  private observeReconciliation(routeState: Observable<InvestigationRoute>): void {
    routeState
      .pipe(
        switchMap((route) => {
          this.resetForRoute(route);

          return this.retry.pipe(
            startWith(undefined),
            switchMap(() => this.loadReconciliation(route)),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((record) => {
        this.result.set(record);
        this.state.set(record ? 'ready' : 'error');
      });
  }

  private resetForRoute(route: InvestigationRoute): void {
    this.invoiceId.set(route.id);
    this.selectedRevision.set(route.revision !== null);
    this.turns.set([]);
  }

  private loadReconciliation(route: InvestigationRoute): Observable<ReconciliationRead | null> {
    this.state.set('loading');
    this.result.set(null);
    this.reconciliationMissing.set(false);

    if (
      route.revision !== null &&
      (!/^[1-9]\d*$/.test(route.revision) || !Number.isSafeInteger(Number(route.revision)))
    ) {
      return of(null);
    }

    const request =
      route.revision !== null
        ? this.api.reconciliationRevision(route.id, Number(route.revision))
        : this.api.latestReconciliation(route.id);

    return request.pipe(
      map((record) => {
        this.focusLine(record, route.line);

        return record;
      }),
      catchError((error: unknown) => {
        this.reconciliationMissing.set(
          route.revision === null &&
            error instanceof HttpErrorResponse &&
            error.status === 404 &&
            error.error?.error?.code === 'reconciliation_not_found',
        );

        return of(null);
      }),
    );
  }

  private focusLine(record: ReconciliationRead, line: string | null): void {
    if (
      line &&
      /^[1-9]\d*$/.test(line) &&
      record.result.lines.some((item) => item.position === Number(line))
    ) {
      afterNextRender(() => this.document.getElementById(`line-${line}`)?.focus(), {
        injector: this.injector,
      });
    }
  }

  private observeQuestions(routeState: Observable<InvestigationRoute>): void {
    routeState
      .pipe(
        switchMap(({ id }) =>
          this.questions.pipe(
            switchMap(({ id: turnId, question }) => this.queryCopilot(id, turnId, question)),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ turnId, answer, error }) => {
        this.turns.update((turns) =>
          turns.map((turn) =>
            turn.id === turnId
              ? {
                  ...turn,
                  answer,
                  error,
                  sources: (answer?.citations ?? []).map((ref) =>
                    resolveEvidence(ref, this.result(), this.invoiceId()),
                  ),
                  state: answer ? 'ready' : 'error',
                }
              : turn,
          ),
        );
      });
  }

  private queryCopilot(
    invoiceId: string,
    turnId: number,
    question: string,
  ): Observable<{ turnId: number; answer: CopilotAnswer | null; error: string }> {
    return this.api.queryCopilot({ question, invoiceId }).pipe(
      takeUntil(this.cancelQuestion),
      map((answer) => ({ turnId, answer, error: '' })),
      catchError((error: unknown) => of({ turnId, answer: null, error: this.errorMessage(error) })),
    );
  }

  load(): void {
    this.cancelQuestion.next();
    this.turns.set([]);
    this.retry.next();
  }

  ask(question: string): void {
    const turn: ConversationTurn = {
      id: ++this.nextTurnId,
      question,
      answer: null,
      sources: [],
      error: '',
      state: 'loading',
    };
    this.turns.update((turns) => [...turns, turn]);
    this.questions.next({ id: turn.id, question });
  }

  retryAnswer(): void {
    const lastTurn = this.turns().at(-1);
    if (!lastTurn || lastTurn.state !== 'error') return;

    this.turns.update((turns) =>
      turns.map((turn) =>
        turn.id === lastTurn.id ? { ...turn, error: '', state: 'loading' } : turn,
      ),
    );
    this.questions.next({ id: lastTurn.id, question: lastTurn.question });
  }

  private errorMessage(error: unknown): string {
    const code = error instanceof HttpErrorResponse ? error.error?.error?.code : '';
    if (code === 'reconciliation_required')
      return 'No reconciliation is available. Run one in the invoice workspace and retry.';
    if (code === 'reconciliation_stale')
      return 'The reconciliation is stale. Run it again and retry.';
    if (code === 'reconciliation_unavailable')
      return 'Current evidence is unavailable. Check the invoice and purchase order and retry.';

    return 'The investigation is unavailable. Please retry.';
  }
}
