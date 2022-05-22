from collections import defaultdict
import json


with open("filtered_words.json", "r") as f:
    wordlist = json.load(f)


DECLENSION_TAGS = [{number, case} for number in ("singular", "plural") for case in ("nominative", "genitive", "dative", "accusative")]
FILTER_ARTICLES = [{"der", "ein", "die", "eine"}, {"des", "eines", "der", "einer"}, {"dem", "einem", "der", "einer"}, {"den", "einen", "die", "eine"}, {"die", "keine"}, {"der", "keiner"}, {"den", "keinen"}, {"die", "keine"}]

def get_declension(word):
    res = [[[] for _ in range(3)] for _ in range(8)]  # [strong, mixed, weak]
    for form in word.get("forms", []):
        tags = form["tags"]
        for i, test_tags in enumerate(DECLENSION_TAGS):
            if test_tags.issubset(tags):
                form = form["form"]
                if form in FILTER_ARTICLES[i]:
                    continue
                declension_type = "all"
                for tag in set(tags) - test_tags:
                    if tag in ("strong", "mixed", "weak"):
                        if declension_type != "all":
                            print("WARNING:", word["word"], "has multiple declension tags:", set(tags))
                        declension_type = ["strong", "mixed", "weak"].index(tag)
                if declension_type == "all":
                    for j in range(3):
                        if form not in res[i][j]:
                            res[i][j].append(form)
                else:
                    if form not in res[i][declension_type]:
                        res[i][declension_type].append(form)
                break
    return res

def declension_is_complete(declension):
    return all(all(x) for x in declension)

def declension2str(declension):
    return " ".join(("|".join(forms) if forms else "-") for forms in declension)


word_declensions = []

for word, feminine_words in wordlist:
    masculine_declension = get_declension(word)
    if not declension_is_complete(masculine_declension):
        print("Skipping, declension is incomplete:", word["word"])
        continue
    feminine_declensions = []
    for w in feminine_words:
        if type(w) is str:
            # feminine word without dictionary entry, try to guess declension
            if w.endswith("in"):
                feminine_declensions.append([[[w]]*3]*4 + [[[w+"nen"]]*3]*4)
            elif w.endswith("e"):
                feminine_declensions.append([[[w]]*3, [[w+"n"]]*3, [[w+"n"]]*3, [[w]]*3] + [[[w+"n"]]*3]*4)
            elif w.lower().endswith("frau"):
                feminine_declensions.append([[[w]]*3]*4 + [[[w+"en"]]*3]*4)
            else:
                print("No guess for declension:", w)
                continue
        else:
            declension = get_declension(w)
            if not declension_is_complete(declension):
                print("Feminine declension is incomplete:", w["word"])
                continue
            feminine_declensions.append(declension)
    if not feminine_declensions:
        print("Skipping, no feminine declensions:", word["word"])
        continue
    feminine_declensions = list(filter(lambda d: d != masculine_declension, feminine_declensions))
    if not feminine_declensions:
        print("Skipping, feminine declension is identical:", word["word"])
        continue
    # merge feminine_declensions into one
    feminine_declension = [[list({form for d in feminine_declensions for form in d[i][j]}) for j in range(3)] for i in range(8)]
    if word["word"] in word_declensions:
        print("Word is present multiple times:", word["word"])
    word_declensions.append((word["word"], masculine_declension, feminine_declension))


def simplify_declension(declension):
    return [(x[0][0] if x[0]==x[1]==x[2] else [y[0] for y in x]) for x in declension]

with open("./../content/word_declensions.js", "w") as f:
    f.write("/* auto-generated file, do not modify! */\nconst WORD_DECLENSIONS = [\n")
    for word, masculine_declension, feminine_declension in word_declensions:
        f.write(json.dumps([simplify_declension(masculine_declension), simplify_declension(feminine_declension)], ensure_ascii=False, separators=(",",":")))
        f.write(",\n")
    f.write("]\n")


word_types = {}

DECLENSION_TYPES = ["sn", "sg", "sd", "sa", "pn", "pg", "pd", "pa"]

def add_word_types(word_id, declension, gender):
    for number_case, x in zip(DECLENSION_TYPES, declension):
        for sxw, forms in zip("sxw", x):
            type_ = sxw+gender+number_case
            for w in forms:
                if w in word_types:
                    if type_ not in word_types[w][1]:
                        word_types[w][1].append(type_)
                else:
                    word_types[w] = [word_id, [type_]]

for id_, (word, masculine_declension, feminine_declension) in enumerate(word_declensions):
    add_word_types(id_, masculine_declension, "m")
    add_word_types(id_, feminine_declension, "f")
    if (feminine_form := feminine_declension[0][0][0]).endswith("in"):
        feminine_form = feminine_form[:-2]
        #add_word_types(id_, [[[feminine_form+"*in"]]*3]*4 + [[[feminine_form+"*innen"]]*3]*4, "*")
    else:
        print("Don't know how to gender:", feminine_form)

with open("./../content/word_types.js", "w") as f:
    f.write("/* auto-generated file, do not modify! */\nconst WORD_TYPES = {\n")
    for word, types in word_types.items():
        f.write(json.dumps(word, ensure_ascii=False))
        f.write(":")
        f.write(json.dumps(types, ensure_ascii=False, separators=(",",":")))
        f.write(",\n")
    f.write("}\n")
