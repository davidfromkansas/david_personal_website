"""Shrink a .glb by about half with KHR_mesh_quantization (no decoder needed in three.js).

Positions become normalized int16 (each mesh moves into a child node whose transform
undoes the quantization), normals int8 and texture coordinates in [0, 1] uint16.

Run: python3 quantize_glb.py IN.glb OUT.glb
"""
import json
import struct
import sys

import numpy as np

COMP = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    d = open(path, "rb").read()
    jl = struct.unpack("<I", d[12:16])[0]
    gltf = json.loads(d[20:20 + jl])
    bl = struct.unpack("<I", d[20 + jl:24 + jl])[0]
    return gltf, d[28 + jl:28 + jl + bl]


def accessor_array(gltf, binary, i):
    a = gltf["accessors"][i]
    bv = gltf["bufferViews"][a["bufferView"]]
    dt = np.dtype(COMP[a["componentType"]])
    n = NCOMP[a["type"]]
    stride = bv.get("byteStride", dt.itemsize * n)
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    raw = np.frombuffer(binary, dtype=np.uint8, count=stride * (a["count"] - 1) + dt.itemsize * n, offset=start)
    out = np.lib.stride_tricks.as_strided(raw, shape=(a["count"], dt.itemsize * n), strides=(stride, 1)).copy()
    return out.view(dt).reshape(a["count"], n)


def main(src, dst):
    gltf, binary = read_glb(src)
    chunks, views, accessors = [], [], []

    def add(arr, comp, typ, target=None, normalized=False, minmax=False, pad_to=None):
        data = np.ascontiguousarray(arr)
        if pad_to and data.shape[1] < pad_to:
            data = np.concatenate([data, np.zeros((len(data), pad_to - data.shape[1]), data.dtype)], axis=1)
        b = data.tobytes()
        off = sum(len(c) for c in chunks)
        chunks.append(b + b"\0" * (-len(b) % 4))
        view = {"buffer": 0, "byteOffset": off, "byteLength": len(b)}
        if target:
            view["target"] = target
        if pad_to:
            view["byteStride"] = data.itemsize * pad_to
        views.append(view)
        acc = {"bufferView": len(views) - 1, "componentType": comp, "count": len(arr), "type": typ}
        if normalized:
            acc["normalized"] = True
        if minmax:
            acc["min"] = arr.min(axis=0).tolist()
            acc["max"] = arr.max(axis=0).tolist()
        accessors.append(acc)
        return len(accessors) - 1

    # Images keep their bytes.
    for img in gltf.get("images", []):
        if "bufferView" in img:
            bv = gltf["bufferViews"][img["bufferView"]]
            b = binary[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
            off = sum(len(c) for c in chunks)
            chunks.append(b + b"\0" * (-len(b) % 4))
            views.append({"buffer": 0, "byteOffset": off, "byteLength": len(b)})
            img["bufferView"] = len(views) - 1

    mesh_xform = {}
    for mi, mesh in enumerate(gltf["meshes"]):
        pos_all = np.concatenate([accessor_array(gltf, binary, p["attributes"]["POSITION"]) for p in mesh["primitives"]])
        lo, hi = pos_all.min(axis=0), pos_all.max(axis=0)
        half = np.maximum((hi - lo) / 2, 1e-6)
        mid = lo + half
        mesh_xform[mi] = (mid, half)
        for prim in mesh["primitives"]:
            attrs = {}
            for name, ai in prim["attributes"].items():
                arr = accessor_array(gltf, binary, ai)
                if name == "POSITION":
                    q = np.round((arr - mid) / half * 32767).clip(-32767, 32767).astype(np.int16)
                    attrs[name] = add(q, 5122, "VEC3", 34962, normalized=True, minmax=True, pad_to=4)
                elif name == "NORMAL":
                    q = np.round(arr * 127).clip(-127, 127).astype(np.int8)
                    attrs[name] = add(q, 5120, "VEC3", 34962, normalized=True, pad_to=4)
                elif name.startswith("TEXCOORD") and arr.min() >= 0 and arr.max() <= 1:
                    q = np.round(arr * 65535).astype(np.uint16)
                    attrs[name] = add(q, 5123, "VEC2", 34962, normalized=True)
                else:
                    attrs[name] = add(arr, 5126, gltf["accessors"][ai]["type"], 34962, minmax=name == "POSITION")
            prim["attributes"] = attrs
            if "indices" in prim:
                idx = accessor_array(gltf, binary, prim["indices"]).ravel()
                if idx.max() < 65535:
                    prim["indices"] = add(idx.astype(np.uint16)[:, None], 5123, "SCALAR", 34963)
                else:
                    prim["indices"] = add(idx.astype(np.uint32)[:, None], 5125, "SCALAR", 34963)

    # Each mesh moves to a new child node that scales and offsets it back to metres.
    nodes = gltf["nodes"]
    for node in list(nodes):
        if "mesh" not in node:
            continue
        mi = node.pop("mesh")
        mid, half = mesh_xform[mi]
        nodes.append({"mesh": mi, "translation": mid.tolist(), "scale": half.tolist()})
        node.setdefault("children", []).append(len(nodes) - 1)

    gltf["accessors"] = accessors
    gltf["bufferViews"] = views
    body = b"".join(chunks)
    gltf["buffers"] = [{"byteLength": len(body)}]
    for key in ("extensionsUsed", "extensionsRequired"):
        gltf[key] = sorted(set(gltf.get(key, [])) | {"KHR_mesh_quantization"})
    js = json.dumps(gltf, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    total = 12 + 8 + len(js) + 8 + len(body)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A) + js)
        f.write(struct.pack("<II", len(body), 0x004E4942) + body)
    print(src, "->", dst, total)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
