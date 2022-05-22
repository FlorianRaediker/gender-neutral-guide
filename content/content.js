

/*
a word is described by the following string, as seen in word_types.js

 [swx][mf*][sp][ngda]

 [swx]: strong (ohne Artikel), weak (bestimmter Artikel), mixed (unbestimmter Artikel)
 [mf*]: masculine, feminine, gendered
 [sp]: singular, plural
 [ngda]: nominative, genitive, dative, accusative
*/


const ARTICLES = {
    "der": ["wmsn", "wmpg", "wfsg", "wfsd", "wfpg"],
    "des": ["wmsg"],
    "dem": ["wmsd"],
    "den": ["wmsa", "wmpd", "wfpd"],
    "die": ["wmpn", "wmpa", "wfsn", "wfsa", "wfpn", "wfsa"],

    "ein":   ["xmsn"],
    "eines": ["xmsg"],
    "einem": ["xmsd"],
    "einen": ["xmsa"]
};

const ARTICLE_DECLENSIONS = {
    "w": [
        ["der",           "des",          "dem",          "den",         "die", "der", "den", "die"], 
        ["die",           "der",          "der",          "die",         "die", "der", "den", "die"],
        [["der", "die"], ["des", "der"], ["dem", "der"], ["den", "die"], "die", "der", "den", "die"]
    ],
    "x": [
        ["ein",    "eines",            "einem",           "einen",  null, null, null, null],
        ["eine",   "einer",            "einer",           "eine",   null, null, null, null],
        ["ein*e", ["eines", "einer"], ["einem", "einer"], "eine*n", null, null, null, null]
    ]
};


const REGEX_WORD = /(bzw\.|[a-zäöüß\-*_:()]+|\/|\d([\d.]*\d)?)/gi;


const CONSTRUCTS = [

    // die Schüler => die Schüler*innen
    [
        {number: "p"},
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "m"
        }
    ],

    /*// (die) Schüler*in(nen)
    [
        {
            type: "word",
            gender: "*",
            article: "optional"
        }
    ],*/

    // (die) Schülerinnen und/oder/bzw. (die) Schüler => die Schüler*innen
    [
        {number: "p"},
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "f"
        },
        {
            type: "literal",
            literal: ["und", "oder", "/", "bzw."]
        },
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "m"
        }
    ],
    [
        {number: "p"},
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "m"
        },
        {
            type: "literal",
            literal: ["und", "oder", "/", "bzw."]
        },
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "f"
        }
    ],

    // der Schüler und/oder die Schülerin => die*der Schüler*in
    [
        {number: "s"},
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "m"
        },
        {
            type: "literal",
            literal: ["und", "oder", "/", "bzw."]
        },
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "f"
        }
    ],
    [
        {number: "s"},
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "f"
        },
        {
            type: "literal",
            literal: ["und", "oder", "/", "bzw."]
        },
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "m"
        }
    ],

    // 50 Schüler => 50 Schüler*innen
    [
        {replace: {number: "p"}},
        {
            type: "number",
            preserve: true
        },
        {
            type: "word",
            gender: "m"
        }
    ],
];



function genderWord(wordId, article, preserve, numberCase) {
    function getDeclinedWord(wordId, genderIndex, caseIndex, articleIndex) {
        let word = WORD_DECLENSIONS[wordId][genderIndex][caseIndex];
        if (Array.isArray(word)) {
            return word[articleIndex];
        }
        return word;
    }

    console.assert(numberCase.length > 0);
    let genderedWords = [];
    for (const nc of numberCase) {
        let caseIndex = (nc[0] === "s" ? 0 : 4) + "ngda".indexOf(nc[1]);
        let articleIndex = "swx".indexOf(article);  // strong, weak, or mixed;

        let articleStr = "";
        if (article === "w" || article === "x") {
            articleStr = ARTICLE_DECLENSIONS[article][2][caseIndex];
        }

        let feminineWord = getDeclinedWord(wordId, 1, caseIndex, articleIndex);
        
        let genderedWord;
        if (nc[0] === "s" && feminineWord.endsWith("in")) {
            genderedWord = feminineWord.substring(0, feminineWord.length-3) + "*in";
        } else if (nc[0] === "p" && feminineWord.endsWith("innen")) {
            genderedWord = feminineWord.substring(0, feminineWord.length-5) + "*innen";
        } else {
            let masculineWord = getDeclinedWord(wordId, 0, caseIndex, articleIndex);
            if (feminineWord === masculineWord) {
                if (!articleStr || !Array.isArray(articleStr)) {
                    // no need to gender, it's already gender-neutral
                    continue;
                }
                genderedWord = feminineWord;
            } else {
                if (feminineWord.startsWith(masculineWord)) {
                    genderedWord = masculineWord + "*" + feminineWord.substring(masculineWord.length);
                } else if (masculineWord.startsWith(feminineWord)) {
                    genderedWord = feminineWord + "*" + masculineWord.substring(feminineWord.length);
                } else {
                    genderedWord = masculineWord + "*" + feminineWord;
                }
            }
        }

        if (Array.isArray(articleStr)) {
            articleStr = articleStr.join("*") + " ";
        } else {
            articleStr += " ";
        }
        
        let gendered = articleStr + preserve + genderedWord;
        if (!genderedWords.includes(gendered)) {
            genderedWords.push(gendered);
        }
    }
    return genderedWords;
}


function checkConstructConstraint(construct, word, properties) {
    console.assert(properties.position<construct.length);
    const constraints = construct[properties.position];
    properties.position++;

    switch (constraints.type) {
    case "article":
        let articleTypes = ARTICLES[word];
        if (articleTypes) {
            properties.articleTypes = articleTypes;
            properties.article = articleTypes[0][0];  // "w" (weak) or "x" (mixed)
            return true;
        }
        if (constraints.optional) {
            return checkConstructConstraint(construct, word, properties);
        }
        return false;
    case "word":
        const wordId_types = WORD_TYPES[word];
        if (!wordId_types) {
            return false;
        }
        let [wordId, types] = wordId_types;

        // check or set wordId
        if (properties.wordId && properties.wordId !== wordId) {
            return false;
        }
        properties.wordId = wordId;

        // check types
        types = types.filter(type => (!constraints.gender || constraints.gender.includes(type[1])));
        if (properties.articleTypes) {
            types = types.filter(type => properties.articleTypes.includes(type));
            properties.articleTypes = null;
        }
        if (types.length === 0) {
            return false;
        }

        // check global number and case property
        if (properties.numberCase) {
            properties.numberCase = properties.numberCase.filter(numberCase => types.some(type => numberCase[0] === type[2] && numberCase[1] === type[3]));
            if (properties.numberCase.length === 0) {
                return false;
            }
        } else {
            properties.numberCase = [];
            for (const type of types) {
                const nc = type[2] + type[3];
                if (!properties.numberCase.includes(nc)) {
                    properties.numberCase.push(nc);
                }
            }
        }

        const globalConstraints = construct[0];

        if (properties.position === construct.length) {
            // matching finished
            // check global constraints
            if (properties.numberCase.every(nc => 
                    (!globalConstraints.number || globalConstraints.number.includes(nc[0])) &&
                    (!globalConstraints.case || globalConstraints.case.includes(nc[1])))) {
                return "finished";
            }
            return false;
        }
        

        // check if global constraints on number and case can still be fulfilled
        if (!properties.numberCase.some(nc => 
                (!globalConstraints.number || globalConstraints.number.includes(nc[0])) && 
                (!globalConstraints.case || globalConstraints.case.includes(nc[1])))) {
            return false;
        }

        return true;
    case "literal":
        return constraints.literal.includes(word);
    case "number":
        if (constraints.preserve) {
            properties.preserve += word + " ";
        }
        return /\d([\d.]*\d)?/.test(word);
    }
}


/**
 * 
 * @param {String} text 
 * @returns 
 */
 function replaceText(text) {
    //console.log("text", text);
    const matchingsToReplace = [];
    let currentMatchings = [];
    for (const match of text.matchAll(REGEX_WORD)) {
        const word = match[0];

        function addFinishedMatching(matching) {
            if (matchingsToReplace.length === 0 || matching.startIndex !== matchingsToReplace[matchingsToReplace.length-1][0]) {
                matchingsToReplace.push([matching.startIndex, [[match.index + word.length, matching]]]);
            } else {
                matchingsToReplace[matchingsToReplace.length-1][1].push([match.index + word.length, matching]);
            }
        }

        let matchingFinished = false;
        for (let i=0; i<currentMatchings.length; i++) {
            const matching = currentMatchings[i];
            const checkResult = checkConstructConstraint(matching.construct, word, matching.properties)
            if (checkResult) {
                //console.log(checkResult === "finished" ? "match finished" : "match", matching.constructId, word, matching.properties);
                if (checkResult === "finished") {
                    // store matchings by start index with their end index (=match.index + word.length) so that later, the longest matching can be chosen
                    addFinishedMatching(matching);
                    matchingFinished = true;
                    currentMatchings = [];
                    break;  // there shouldn't be multiple matchings with the same start and end
                }
            } else {
                //console.log("no longer match", matching.constructId, word, matching.properties);
                currentMatchings.splice(i, 1);
                i--;
            }
        }

        if (currentMatchings.length === 0 && !matchingFinished) {
            let hasMatch = false;
            for (let constructId=0; constructId<CONSTRUCTS.length; constructId++) {
                const construct = CONSTRUCTS[constructId];
                let properties = {
                    position: 1,
                    wordId: null,
                    numberCase: null,
                    articleTypes: null,
                    article: "s",  // strong (no article); possibly replaced by checkConstructConstraint with "w" or "x"
                    preserve: ""
                };
                const checkResult = checkConstructConstraint(construct, word, properties)
                if (checkResult) {
                    hasMatch = true;
                    //console.log(checkResult === "finished" ? "match new and finished" : "match new", constructId, word, properties);
                    let matching = {
                        constructId,
                        construct,
                        properties,
                        startIndex: match.index
                    };
                    if (checkResult === "finished") {
                        addFinishedMatching(matching);
                    } else {
                        currentMatchings.push(matching);
                    }
                }
            }
            if (!hasMatch) {
                //console.log("no match", word);
            }
        }
    }

    let res = "";
    let lastEndIndex = 0;
    let counter = 0;
    for (let [startIndex, matchings] of matchingsToReplace) {
        let maxEndIndex = 0;
        let maxMatching = null;
        for (let [endIndex, matching] of matchings) {
            if (endIndex > maxEndIndex) {
                maxEndIndex = endIndex;
                maxMatching = matching;
            }
        }
        
        const replaceRules = maxMatching.construct[0].replace || {};
        const numberCase = [];
        for (let nc of maxMatching.properties.numberCase) {
            if (replaceRules.number) nc = replaceRules.number + nc[1];
            if (replaceRules.case)   nc = nc[0] + replaceRules.case;
            if (!numberCase.includes(nc)) {
                numberCase.push(nc);
            }
        }
        const genderedWords = genderWord(maxMatching.properties.wordId, maxMatching.properties.article, maxMatching.properties.preserve, numberCase);
        let genderedWord;
        if (genderedWords.length === 0) {
            console.log("no need to gender", WORD_DECLENSIONS[maxMatching.properties.wordId][0][0], maxMatching.properties.article, numberCase);
            continue;
        }
        if (genderedWords.length === 1) {
            genderedWord = genderedWords[0];
        } else {
            // there are multiple possibilities in numberCase which unfortunately produce different gendered words
            console.warn("can't be sure how to gender", WORD_DECLENSIONS[maxMatching.properties.wordId][0][0], numberCase, genderedWords);
            genderedWord = genderedWords.join(" / ");
        }
        res += (
            text.substring(lastEndIndex, maxMatching.startIndex) + 
            '<mark title="' + text.substring(maxMatching.startIndex, maxEndIndex) + 
            '" style="background-color:#ffff0080!important" data-gendered-number-case="' + maxMatching.properties.numberCase.join(",") + '">' +
            genderedWord + "</mark>");
        lastEndIndex = maxEndIndex;
        counter++;
    }
    res += text.substring(lastEndIndex);

    return [counter, res];
}


let counter = 0;

const SKIP_TAGS = ["style", "script", "svg"];

/**
 * @param {Node} node 
 */
function iterNodes(node) {
    let nodes = [node];
    while (nodes.length > 0) {
        let nextNodes = [];
        for (let node of nodes) {
            if (node.tagName && SKIP_TAGS.includes(node.tagName.toLowerCase())) continue;
            if (node.nodeType === Node.ELEMENT_NODE) {
                nextNodes.push(...node.childNodes);
            } else if (node.nodeType === Node.TEXT_NODE) {
                let [c, text] = replaceText(node.textContent);
                if (c !== 0) {
                    counter += c;
                    const newNode = document.createElement("div");
                    newNode.innerHTML = text;
                    node.replaceWith(...newNode.childNodes);
                }
            }
        }
        nodes = nextNodes;
    }
}


console.time("gender-neutral-guide:gender");
iterNodes(document.body);
console.timeEnd("gender-neutral-guide:gender");

browser.runtime.sendMessage({setBadge: counter});
