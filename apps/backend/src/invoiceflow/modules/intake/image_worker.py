"""Decode, orient and sanitize a single JPEG or PNG in a bounded child process."""

import io
import sys
import warnings

from invoiceflow.modules.intake.pdf_check import limit_memory


def main():
    limit_memory()
    from PIL import Image, ImageOps, UnidentifiedImageError

    Image.MAX_IMAGE_PIXELS = 20_000_000
    warnings.simplefilter("error", Image.DecompressionBombWarning)
    try:
        with Image.open(sys.argv[1]) as image:
            if image.format != sys.argv[2] or getattr(image, "n_frames", 1) != 1:
                return 3
            if image.width * image.height > Image.MAX_IMAGE_PIXELS:
                return 2
            image.verify()
        with Image.open(sys.argv[1]) as image:
            image.load()
            oriented = ImageOps.exif_transpose(image)
            if sys.argv[3] == "preview":
                oriented.thumbnail((1600, 1600))
            # A new image drops EXIF, ICC profiles and all other source metadata.
            clean = Image.new("RGB", oriented.size, "white")
            if "A" in oriented.getbands() or "transparency" in oriented.info:
                rgba = oriented.convert("RGBA")
                clean.paste(rgba, mask=rgba.getchannel("A"))
            else:
                clean.paste(oriented.convert("RGB"))
            output = io.BytesIO()
            clean.save(output, format="JPEG", quality=85)
            sys.stdout.buffer.write(output.getvalue())
        return 0
    except (Image.DecompressionBombWarning, Image.DecompressionBombError):
        return 2
    except (OSError, ValueError, SyntaxError, UnidentifiedImageError):
        return 3


if __name__ == "__main__":
    sys.exit(main())
