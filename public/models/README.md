# 3D models

Drop .glb or .gltf files here, then set their paths in `app/content.ts`.
Each project in `work` has a `model` field for its planet, e.g. `model: "/models/agm.glb"`.

Until a slot has a model, a GLSL shader planet renders in its place. The planet keeps
its orbit, spin, hover and click behaviour either way.
