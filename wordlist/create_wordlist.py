from collections import defaultdict
import json


with open("filtered_words.json", "r") as f:
    wordlist = json.load(f)


EXCLUDE_WORDS = {"Mensch", "Mann", "Flüchtling", "Fisch"}  # words which have a masculine and a feminine form in Wiktionary but shouldn't be gendered
EXCLUDE_FEMININE_WORDS = {"Landsmännin"}  # words which are listed in Wiktionary as feminine but which definitely shouldn't be used
wordlist = [w for w in wordlist if w[0]["word"] not in EXCLUDE_WORDS]


DECLENSION_TAGS = [{number, case} for number in ("singular", "plural") for case in ("nominative", "genitive", "dative", "accusative")]
FILTER_ARTICLES = [{"der", "ein", "die", "eine"}, {"des", "eines", "der", "einer"}, {"dem", "einem", "der", "einer"}, {"den", "einen", "die", "eine"}, {"die", "keine"}, {"der", "keiner"}, {"den", "keinen"}, {"die", "keine"}]

def get_declension(word):
    res = [[[], [], []] for _ in range(8)]  # [strong, mixed, weak]
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



# WORD DECLENSIONS

word_declensions = []

for word, feminine_words in wordlist:
    masculine_declension = get_declension(word)
    if not declension_is_complete(masculine_declension):
        print("Skipping, declension is incomplete:", word["word"])
        continue
    feminine_declensions = []
    for w in feminine_words:
        if type(w) is str:
            if w in EXCLUDE_FEMININE_WORDS:
                continue
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
            if w["word"] in EXCLUDE_FEMININE_WORDS:
                continue
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
    def merge_forms(forms):
        res = []
        for form in forms:
            if form not in res:
                res.append(form)
        return res
    feminine_declension = [[merge_forms(form for d in feminine_declensions for form in d[i][j]) for j in range(3)] for i in range(8)]

    neutral_declension = None
    # words with singular ending in "-frau" and "-mann((e)s)" should have gender-neutral plural forms ending in "-leute(n)"
    if (all(any(form.lower().endswith("mann") or form.lower().endswith("mannes") or form.lower().endswith("manns") for form in forms) for word in masculine_declension[:4] for forms in word) and
        all(any(form.lower().endswith("frau") for form in forms) for word in feminine_declension[:4] for forms in word)):
        new_neutral_declension = [None, None, None, None]
        delete_indices = []  # indices of forms to delete if all forms are found
        success = True
        # search plural forms ending in "-leute(n)"
        # ATTENTION: words ending in "-leute(n)" are removed and will not be present in NOUN_FORMS!
        #            This is not a problem since these words are already gender-neutral
        for i, number_case in enumerate(masculine_declension[4:], 4):
            new_forms = []
            for j, forms in enumerate(number_case):
                for k, form in enumerate(forms):
                    form_lower = form.lower()
                    if form_lower.endswith("leute") or form_lower.endswith("leuten"):
                        new_forms.append([form])
                        delete_indices.append((i, j, k))
                        break
                else:
                    # loop did not break
                    success = False
                    break
            if not success:
                break
            new_neutral_declension.append(new_forms)
        if success:
            neutral_declension = new_neutral_declension
            for i in delete_indices:
                del masculine_declension[i[0]][i[1]][i[2]]
            print("Added neutral declension for", word["word"], neutral_declension)
        else:
            print('Word singular ends in "-frau" and "-mann((e)s), but plural doesn\'t end in "-leute":', word["word"])
    word_declensions.append((word["word"], masculine_declension, feminine_declension, neutral_declension))


def compress_declensions(*declensions):
    i = 0
    for characters in zip(*(word[0] for declension in declensions for words in declension if words is not None for word in words)):
        if any(characters[0] != c for c in characters[1:]):
            break
        i += 1
    # starting at i, the word's characters differ
    return [declensions[0][0][0][0][:i]] + [[(x[0][0][i:] if x[0]==x[1]==x[2] else [y[0][i:] for y in x]) if x is not None else None for x in declension] for declension in declensions]


# WORD TYPES

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

for id_, (word, masculine_declension, feminine_declension, _) in enumerate(word_declensions):
    add_word_types(id_, masculine_declension, "m")
    add_word_types(id_, feminine_declension, "f")



with open("./../content/wordlist.js", "w") as f:
    f.write("""/* AUTO-GENERATED FILE, DO NOT MODIFY! */

const NOUN_DECLENSIONS = [
""")
    for word, masculine_declension, feminine_declension, neutral_declension in word_declensions:
        declensions = (masculine_declension, feminine_declension, neutral_declension) if neutral_declension else (masculine_declension, feminine_declension)
        f.write(json.dumps(compress_declensions(*declensions), ensure_ascii=False, separators=(",",":")))
        f.write(",\n")

    f.write("]\n\n\nconst NOUN_FORMS = {\n")
    for word, types in word_types.items():
        f.write(json.dumps(word, ensure_ascii=False))
        f.write(":")
        f.write(json.dumps(types, ensure_ascii=False, separators=(",",":")))
        f.write(",\n")
    f.write("}\n")
