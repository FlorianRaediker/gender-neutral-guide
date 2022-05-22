from collections import defaultdict
import json
import locale

from tqdm import tqdm


locale.setlocale(locale.LC_ALL, "de_DE")


words = defaultdict(list)

print("Reading dictionary...")

with open("kaikki.org-dictionary-German-by-pos-noun.json", "r") as f:
    for word in tqdm(f.readlines()):
        word = json.loads(word)
        if word["word"] in words:
            #print("Word is present multiple times:", word["word"])
            pass
        else:
            words[word["word"]].append(word)


wordlist = []

for word_list in words.values():
    for word in word_list:
        if "forms" in word and "senses" in word and any("masculine" in sense.get("tags", []) for sense in word["senses"]):
            feminine_forms = [form for form in word["forms"] if "feminine" in form.get("tags", [])]
            if feminine_forms:
                feminine_words = []
                for form in feminine_forms:
                    form = form["form"]
                    if form in words:
                        feminine_words.extend(words[form])
                    else:
                        print("feminine form not found:", form)
                        feminine_words.append(form)
                wordlist.append((word, feminine_words))

wordlist.sort(key=lambda w: locale.strxfrm(w[0]["word"].lower()))

with open("filtered_words.json", "w") as f:
    json.dump(wordlist, f)
