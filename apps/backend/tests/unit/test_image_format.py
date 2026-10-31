from io import BytesIO
from subprocess import TimeoutExpired

import pytest
from PIL import Image

from invoiceflow.modules.intake.errors import IntakeError
from invoiceflow.modules.intake.image_format import image_preview


@pytest.mark.parametrize("image_format", ["PNG", "JPEG"])
def test_image_preview_is_bounded_and_strips_metadata(tmp_path, image_format):
    # Arrange
    path = tmp_path / "image"
    exif = Image.Exif()
    exif[274] = 6
    exif[270] = "private metadata"
    Image.new("RGB", (1800, 900), "white").save(path, format=image_format, exif=exif)

    # Act
    preview = image_preview(path, image_format)

    # Assert
    with Image.open(BytesIO(preview)) as result:
        assert result.format == "JPEG"
        assert result.size == (800, 1600)
        assert not result.getexif()
        assert "icc_profile" not in result.info


@pytest.mark.parametrize("case", ["truncated", "wrong_format", "pixel_limit"])
def test_invalid_images_are_rejected(tmp_path, case):
    # Arrange
    path = tmp_path / "image"
    size = (5000, 4001) if case == "pixel_limit" else (10, 10)
    Image.new("RGB", size, "white").save(path, format="PNG")
    if case == "truncated":
        path.write_bytes(path.read_bytes()[:20])
    expected_format = "JPEG" if case == "wrong_format" else "PNG"

    # Act
    with pytest.raises(IntakeError) as caught:
        image_preview(path, expected_format)

    # Assert
    assert caught.value.status == (413 if case == "pixel_limit" else 422)


def test_image_processing_timeout_returns_unavailable_without_path(monkeypatch, tmp_path):
    # Arrange
    def timeout(*args, **kwargs):
        raise TimeoutExpired(cmd="decoder", timeout=8)

    monkeypatch.setattr("invoiceflow.modules.intake.image_format.subprocess.run", timeout)

    # Act
    with pytest.raises(IntakeError) as caught:
        image_preview(tmp_path / "private.png", "PNG")

    # Assert
    assert caught.value.status == 503
    assert caught.value.code == "image_processing_unavailable"
    assert "private" not in caught.value.message
