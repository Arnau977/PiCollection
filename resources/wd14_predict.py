import csv
import json
import sys

import numpy as np
import onnxruntime as rt
from PIL import Image

# https://github.com/toriato/stable-diffusion-webui-wd14-tagger/blob/a9eacb1eff904552d3012babfa28b57e1d3e295c/tagger/ui.py#L368
KAOMOJIS = {
    "0_0", "(o)_(o)", "+_+", "+_-", "._.", "<o>_<o>", "<|>_<|>", "=_=",
    ">_<", "3_3", "6_9", ">_o", "@_@", "^_^", "o_o", "u_u", "x_x", "|_|", "||_||"
}

GENERAL_THRESHOLD = 0.35
CHARACTER_THRESHOLD = 0.85
# Same bar as CHARACTER_THRESHOLD - a copyright/series guess is just as prone
# to false positives as a character guess, so it gets the same conservative
# floor rather than the loose GENERAL_THRESHOLD.
COPYRIGHT_THRESHOLD = 0.85


def load_labels(csv_path):
    tag_names = []
    categories = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row["name"]
            if name not in KAOMOJIS:
                name = name.replace("_", " ")
            tag_names.append(name)
            categories.append(int(row["category"]))
    general_indexes = [i for i, c in enumerate(categories) if c == 0]
    character_indexes = [i for i, c in enumerate(categories) if c == 4]
    copyright_indexes = [i for i, c in enumerate(categories) if c == 3]
    rating_indexes = [i for i, c in enumerate(categories) if c == 9]
    return tag_names, general_indexes, character_indexes, copyright_indexes, rating_indexes


def prepare_image(image, target_size):
    canvas = Image.new("RGBA", image.size, (255, 255, 255))
    canvas.alpha_composite(image.convert("RGBA"))
    image = canvas.convert("RGB")

    max_dim = max(image.size)
    pad_left = (max_dim - image.size[0]) // 2
    pad_top = (max_dim - image.size[1]) // 2

    padded = Image.new("RGB", (max_dim, max_dim), (255, 255, 255))
    padded.paste(image, (pad_left, pad_top))

    if max_dim != target_size:
        padded = padded.resize((target_size, target_size), Image.BICUBIC)

    arr = np.asarray(padded, dtype=np.float32)
    arr = arr[:, :, ::-1]  # RGB -> BGR, matching the model's own training pipeline
    return np.expand_dims(arr, axis=0)


def main():
    model_path, csv_path = sys.argv[1], sys.argv[2]

    tag_names, general_indexes, character_indexes, copyright_indexes, rating_indexes = load_labels(
        csv_path
    )
    session = rt.InferenceSession(model_path, providers=["CPUExecutionProvider"])
    input_meta = session.get_inputs()[0]
    target_size = input_meta.shape[1]
    input_name = input_meta.name
    output_name = session.get_outputs()[0].name

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        request = json.loads(line)
        request_id = request.get("id")
        try:
            image = Image.open(request["path"])
            batch = prepare_image(image, target_size)
            preds = session.run([output_name], {input_name: batch})[0][0]

            tags = []
            for i in general_indexes:
                score = float(preds[i])
                if score > GENERAL_THRESHOLD:
                    tags.append({"name": tag_names[i], "score": score, "category": "general"})
            for i in character_indexes:
                score = float(preds[i])
                if score > CHARACTER_THRESHOLD:
                    tags.append({"name": tag_names[i], "score": score, "category": "character"})
            for i in copyright_indexes:
                score = float(preds[i])
                if score > COPYRIGHT_THRESHOLD:
                    tags.append({"name": tag_names[i], "score": score, "category": "copyright"})
            # Ratings (general/sensitive/questionable/explicit) are mutually
            # exclusive, unlike the categories above - always report the
            # single highest-scoring one instead of threshold-filtering, so
            # the caller can always offer an SFW/NSFW suggestion.
            if rating_indexes:
                best_rating_index = max(rating_indexes, key=lambda i: preds[i])
                tags.append({
                    "name": tag_names[best_rating_index],
                    "score": float(preds[best_rating_index]),
                    "category": "rating"
                })
            tags.sort(key=lambda t: t["score"], reverse=True)

            response = {"id": request_id, "tags": tags}
        except Exception as exc:
            response = {"id": request_id, "error": str(exc)}

        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
