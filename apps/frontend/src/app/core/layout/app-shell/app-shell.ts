import { DOCUMENT } from '@angular/common';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Topbar],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  constructor() {
    afterRenderEffect({
      mixedReadWrite: () => {
        const navigation = this.router.lastSuccessfulNavigation();
        if (!navigation) return;
        const main = this.content().nativeElement;
        const fragment = navigation.finalUrl?.fragment;
        if (fragment && main.contains(this.document.getElementById(fragment))) return;
        main.focus({ preventScroll: true });
      },
    });
  }
}
