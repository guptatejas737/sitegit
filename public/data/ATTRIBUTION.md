# Sitecommit — source and method

Photographs: [iVISION Fall 2024](https://www.kaggle.com/datasets/danielmao2019/ivision-fall2024),
by the iVISION research contributors. Research project and author information:
[iVISION: A Longitudinal Construction Site Dataset](https://danielmao2019.github.io/iVISION-2DCD-dataset.github.io/).
The public Kaggle dataset identifies its license as **MIT**. Credits: Dayou Mao,
Yuchen Lin, Ashkan Ebadi, John Zelek, Alexander Wong and Yuhao Chen.

The demo uses 60 original photographs on each of **27 September, 18 October and
27 November 2024**. These are actual capture dates. “Preparation”, “Groundworks” and
“Foundations” describe visible work; they are not official milestone classifications.

The photographs were resized, reconstructed independently with COLMAP, trained
as 3D Gaussian splats with Brush, aligned using unchanged visual features and
compressed to SPZ. No model from another site, synthetic construction phase,
vertical reveal or external embedded viewer is used. Each dated model and still
is served from this application. Training settings, source-file hashes and the
full pipeline are included in the source repository.

Per-record reports: [September](./surveys/2024-09-27.json),
[October](./surveys/2024-10-18.json), [November](./surveys/2024-11-27.json).
The reports distinguish original training artifacts from compressed viewer assets.

This is an aerial vision demonstration with imperfect boundaries and unobserved
surfaces. It is not a dimensional survey or a production phone-video service.

Software: [COLMAP](https://github.com/colmap/colmap) (BSD),
[Brush](https://github.com/ArthurBrussee/brush) (Apache 2.0),
[Spark](https://github.com/sparkjsdev/spark) (MIT),
[Three.js](https://github.com/mrdoob/three.js) (MIT). Custom app/pipeline code: MIT.
