"""In-memory scientific drawings for the fixed Arhimed ManimGX runtime.

These adapters never open files, use network resources or create GUI windows.
Figures are snapshots; use ManimGX objects for continuously animated geometry.
"""

from io import BytesIO
from manimgx import ImageMobject


def figure_to_mobject(figure, width=9.0, max_height=4.5, close=True):
    """Capture a Matplotlib Figure as an RGBA ManimGX image, fitted to the scene.

    The Matplotlib Agg backend includes its own text rendering, preserving plot
    labels that would otherwise be lost when importing SVG text into ManimGX.
    """
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    from matplotlib import pyplot as plt

    if not (0 < width <= 12.0 and 0 < max_height <= 6.0):
        raise ValueError("Use width in (0, 12] and max_height in (0, 6].")
    pixels = figure.get_figwidth() * figure.dpi * figure.get_figheight() * figure.dpi
    if pixels > 4_000_000:
        raise ValueError("Scientific figures are limited to four million pixels.")
    canvas = FigureCanvasAgg(figure)
    try:
        canvas.draw()
        # Include labels outside the axes. Schemdraw's default figure bounds
        # otherwise clip component labels when captured directly from RGBA.
        buffer = BytesIO()
        figure.savefig(buffer, format="png", bbox_inches="tight", pad_inches=0.12)
        image = ImageMobject(buffer.getvalue())
        image.scale_to_fit_width(width)
        if image.height > max_height:
            image.scale_to_fit_height(max_height)
        return image
    finally:
        if close:
            plt.close(figure)


def drawing_to_mobject(drawing, width=9.0, max_height=4.5):
    """Capture a Schemdraw Drawing using its non-interactive Matplotlib backend.

    Create it with schemdraw.Drawing(show=False); do not use save() or draw(show=True).
    """
    backend = drawing.draw(show=False, canvas="matplotlib")
    return figure_to_mobject(backend.fig, width=width, max_height=max_height)
