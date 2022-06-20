

/*
a word is described by the following string, as seen in word_types.js

 [swx][mf*][sp][ngda]

 [swx]: strong (ohne Artikel), weak (bestimmter Artikel), mixed (unbestimmter Artikel)
 [mf*]: masculine, feminine, gendered
 [sp]: singular, plural
 [ngda]: nominative, genitive, dative, accusative
*/


const debug_log = () => {};  // console.log


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


const REGEX_WORD = /(bzw\.|[a-zäöüß\-*_:()]+|\/|\d+)/gi;


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

    // (die) Schüler:in(nen)
    [
        {
            type: "article",
            optional: true
        },
        {
            type: "word",
            gender: "*"
        }
    ],

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
        {number: "p", replace: {number: "p"}},
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



function genderWord(nounId, article, preserve, cases) {
    function getDeclinedNoun(wordId, genderIndex, caseIndex, articleIndex) {
        let word = NOUN_DECLENSIONS[wordId][genderIndex][caseIndex];
        if (Array.isArray(word)) {
            return word[articleIndex];
        }
        return word;
    }

    console.assert(cases.length > 0);
    let genderedWords = [];
    for (const nc of cases) {
        let caseIndex = (nc[0] === "s" ? 0 : 4) + "ngda".indexOf(nc[1]);
        let articleIndex = "swx".indexOf(article);  // strong, weak, or mixed;

        let articleStr = "";
        if (article === "w" || article === "x") {
            articleStr = ARTICLE_DECLENSIONS[article][2][caseIndex];
        }

        let feminineWord = getDeclinedNoun(nounId, 1, caseIndex, articleIndex);
        
        let genderedWord;
        if (nc[0] === "s" && feminineWord.endsWith("in")) {
            genderedWord = feminineWord.substring(0, feminineWord.length-2) + "*in";
        } else if (nc[0] === "p" && feminineWord.endsWith("innen")) {
            genderedWord = feminineWord.substring(0, feminineWord.length-5) + "*innen";
        } else {
            let masculineWord = getDeclinedNoun(nounId, 0, caseIndex, articleIndex);
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
        } else if (articleStr) {
            articleStr += " ";
        }
        
        let gendered = articleStr + preserve + genderedWord;
        if (!genderedWords.includes(gendered)) {
            genderedWords.push(gendered);
        }
    }
    return genderedWords;
}

/**
 * @returns 0: no match, 1: matching not finished yet, 2: matching finished and is certainly not false-positive, 3: matching finished and might be false-positive
 */
function checkConstructConstraint(construct, word, properties) {
    console.assert(properties.position<construct.length);
    const constraints = construct[properties.position];
    properties.position++;

    switch (constraints.type) {
    case "article":
        let articleForms = ARTICLES[word];
        if (articleForms) {
            properties.articleForms = articleForms;
            properties.article = articleForms[0][0];  // "w" (weak) or "x" (mixed)
            return 1;
        }
        if (constraints.optional) {
            return checkConstructConstraint(construct, word, properties);
        }
        return 0;
    case "word":
        // remove any gendered suffix since words in NOUN_FORMS are not gendered
        let isGendered;
        if (word.length > 2 && word.endsWith("In")) {
            isGendered = true;
            word = word.substring(0, word.length-2) + "in";
        } else if (word.length > 3 && (word.endsWith("_in") || word.endsWith(":in"))) {
            isGendered = true;
            word = word.substring(0, word.length-3) + "in";
        } else if (word.length > 5 && word.endsWith("Innen")) {
            isGendered = true;
            word = word.substring(0, word.length-5) + "innen";
        } else if (word.length > 6 && (word.endsWith("_innen") || word.endsWith(":innen"))) {
            isGendered = true;
            word = word.substring(0, word.length-6) + "innen";
        } else {
            isGendered = false;
        }


        const nounId_forms = NOUN_FORMS[word];
        if (!nounId_forms) {
            return 0;
        }
        let [nounId, forms] = nounId_forms;


        // check or set nounId
        if (properties.nounId && properties.nounId !== nounId) {
            return 0;
        }
        properties.nounId = nounId;


        // check forms
        if (isGendered) {
            forms = forms.map(form => form[0] + "*" + form[2] + form[3]);
        }
        if (constraints.gender) {
            forms = forms.filter(form => constraints.gender.includes(form[1]));
        }
        if (properties.articleForms) {
            forms = forms.filter(form => properties.articleForms.includes(form));
            properties.articleForms = null;
        }
        if (forms.length === 0) {
            return 0;
        }


        // set and check cases (number+case)
        const globalConstraints = construct[0];

        const filterNumberCase = nc => forms.some(type => nc[0] === type[2] && nc[1] === type[3]);
        if (properties.possibleCases) {
            properties.possibleCases = properties.possibleCases.filter(filterNumberCase);
            properties.otherCases = properties.otherCases.filter(filterNumberCase);
        } else {
            properties.possibleCases = [];
            properties.otherCases = [];
            for (const form of forms) {
                const nc = form[2] + form[3];
                // check if nc fulfills global constraints
                if ((!globalConstraints.number || globalConstraints.number.includes(nc[0])) && 
                    (!globalConstraints.case || globalConstraints.case.includes(nc[1]))) {
                    if (!properties.possibleCases.includes(nc)) {
                        properties.possibleCases.push(nc);
                    }
                } else {
                    if (!properties.otherCases.includes(nc)) {
                        properties.otherCases.push(nc);
                    }
                }
            }
        }
        if (properties.possibleCases.length === 0) {
            return 0;
        }


        if (properties.position === construct.length) {
            // matching finished
            return properties.otherCases.length === 0 ? 2 : 3;
        }

        return 1;
    case "literal":
        return constraints.literal.includes(word) ? 1 : 0;
    case "number":
        if (constraints.preserve) {
            properties.preserve += word + " ";
        }
        return /\d+/.test(word) ? 1 : 0;
    }
}


function searchGenderableWords(text) {
    const matches = [];
    let currentMatches = [];
    let lastIndex = 0;
    for (const wordMatch of text.matchAll(REGEX_WORD)) {
        const word = wordMatch[0];

        debug_log("word", word);

        //if (text.substring(lastIndex, word.index).match(/^\s*$/) == null) {
            // space between words contains non-white space characters
            //currentMatchings = [];
        //}
        lastIndex = wordMatch.index + word.length;

        function addCompletedMatch(match, checkResult) {
            // from all matches with the same startIndex, save the one with the highest endIndex that preferably isn't false-positive
            match = {
                startIndex: match.startIndex,
                endIndex: lastIndex,
                replaceRules: match.construct[0].replace || {},
                nounId: match.properties.nounId,
                possibleCases: match.properties.possibleCases,
                otherCases: match.properties.otherCases,
                article: match.properties.article,
                preserve: match.properties.preserve,
                possiblyFalsePositive: checkResult === 3
            }
            if (matches.length === 0 || match.startIndex !== matches[matches.length-1].startIndex) {
                matches.push(match);
            } else {
                console.assert(matches[matches.length-1].endIndex < match.endIndex || matches[matches.length-1].possiblyFalsePositive);
                matches[matches.length-1] = match;
            }
            return !match.possiblyFalsePositive;
        }

        let matchingFinished = false;
        for (let i=0; i<currentMatches.length; i++) {
            const match = currentMatches[i];
            const checkResult = checkConstructConstraint(match.construct, word, match.properties);
            if (checkResult === 0) {
                // no match
                currentMatches.splice(i, 1);
                i--;
            } else if (checkResult === 2 || checkResult === 3) {
                // matching finished
                if (addCompletedMatch(match, checkResult)) {
                    // match is not false-positive, further matches shouldn't be checked
                    currentMatches = [];
                    matchingFinished = true;
                    debug_log("match finished", matches[matches.length-1]);
                    break;
                }
                // match might be false-positive, so continue with other matches that might be non-false-positive
                currentMatches.splice(i, 1);
                i--;
                matchingFinished = true;
                debug_log("match possibly false-positive", matches[matches.length-1]);
            } else {
                debug_log("continued match", match);
            }
        }

        if (currentMatches.length === 0 && !matchingFinished) {
            for (const construct of CONSTRUCTS) {
                let properties = {  // properties of a match; those may be changed during matching by checkConstructConstraint
                    position: 1,  // number of current word, index in construct
                    nounId: null, // ID of the noun that is used in this construct
                    possibleCases: null, // cases (number+case) that the construct could have which are allowed by the construct
                    otherCases: null,    // cases (number+case) that the construct could have which are not allowed by the construct
                                         // (thus, a non-empty array indicates that the match is possibly a false-positive)
                    articleForms: null, // used internally by checkConstructConstraint 
                    article: "s", // type of article that is used in the construct: by default strong (no article); possibly replaced by checkConstructConstraint with "w" (weak; bestimmter Artikel) or "x" (mixed; unbestimmter Artikel)
                    preserve: ""  // text 
                };
                const checkResult = checkConstructConstraint(construct, word, properties)
                if (checkResult !== 0) {
                    let match = {
                        construct,
                        properties,
                        startIndex: wordMatch.index
                    };
                    if (checkResult === 2 || checkResult === 3) {
                        addCompletedMatch(match, checkResult);
                        debug_log("new and completed match", matches[matches.length-1]);
                    } else {
                        currentMatches.push(match);
                        debug_log("new match", match);
                    }
                }
            }
        }
    }

    return matches;
}


let counter = 0;


/**
 * @param {Text} textNode
 */
function genderTextNode(textNode) {
    /** @type Array.<{startIndex: number, endIndex: number, replaceRules: {number: string, case: string}, nounId: number, possibleCases: string[], otherCases: string[], article: string, preserve: string, possiblyFalsePositive: boolean}> */
    let matches = searchGenderableWords(textNode.textContent);
    textNode.__is_gendered = true;
    for (let i = matches.length-1; i >= 0; i--) {
        const match = matches[i];
        debug_log("match", textNode.textContent, match);
        const nodeToReplace = textNode.splitText(match.startIndex);  // splitText() returns the right part
        nodeToReplace.__is_gendered = true;
        const rightNode = nodeToReplace.splitText(match.endIndex-match.startIndex);
        rightNode.__is_gendered = true;

        function mapCases(cases) {
            const newCases = [];
            for (let nc of cases) {
                if (match.replaceRules.number) nc = match.replaceRules.number + nc[1];
                if (match.replaceRules.case)   nc = nc[0] + match.replaceRules.case;
                if (!newCases.includes(nc)) {
                    newCases.push(nc);
                }
            }
            return newCases;
        }
        const possibleCases = mapCases(match.possibleCases);
        const otherCases = mapCases(match.otherCases);  // TODO
        
        const genderedWords = genderWord(match.nounId, match.article, match.preserve, possibleCases);
        let genderedWord;
        if (genderedWords.length === 0) {
            debug_log("no need to gender", NOUN_DECLENSIONS[match.nounId][0][0], match);
            continue;
        }
        if (genderedWords.length === 1) {
            genderedWord = genderedWords[0];
        } else {
            // there are multiple possibilities in numberCase which unfortunately produce different gendered words
            if (!match.possiblyFalsePositive) console.warn("can't be sure how to gender", NOUN_DECLENSIONS[match.nounId][0][0], match, genderedWords);
            genderedWord = genderedWords.join(" / ");
        }

        const genderedNode = document.createElement("span");
        // TODO: Add rainbow flag as background option
        genderedNode.style = "background-color:" + (match.possiblyFalsePositive ? "#c1840150" : "#ffff0080") + "!important;border-radius:0.3em!important;padding-left:0.15em!important;padding-right:0.15em!important;";
        genderedNode.dataset.gngMatch = JSON.stringify(match);
        genderedNode.__is_gendered = true;

        if (!match.possiblyFalsePositive) {
            genderedNode.textContent = genderedWord;
            genderedNode.title = nodeToReplace.textContent;
            genderedNode.dataset.gngGenderedCount = 1;
            counter++;
        } else {
            genderedNode.textContent = nodeToReplace.textContent;
            genderedNode.title = genderedWord;
        }
        nodeToReplace.replaceWith(genderedNode);
    }
}


const SKIP_TAGS = ["style", "script", "svg", "noscript"];

function iterNodes(node, callback) {
    let nodes = [node];
    while (nodes.length > 0) {
        let nextNodes = [];
        for (let node of nodes) {
            if (node.tagName && SKIP_TAGS.includes(node.tagName.toLowerCase())) continue;
            if (callback(node)) {
                nextNodes.push(...node.childNodes);
            }
        }
        nodes = nextNodes;
    }
}

function iterReplaceCallback(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
        if (!node.__is_gendered && !node.dataset.gngMatch) { // in case the script is injected multiple times
            return true;
        }
        if (node.dataset.gngGenderedCount) counter += parseInt(node.dataset.gngGenderedCount);
        return false;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        genderTextNode(node);
    }
}


// TODO: Check lang tag


console.time("gender-neutral-guide:gender");
iterNodes(document.body, iterReplaceCallback);
console.timeEnd("gender-neutral-guide:gender");
browser.runtime.sendMessage({setBadge: counter});


// TODO: Option to enable/disable MutationObserver
/*const mutationObserver = new MutationObserver((mutationRecords, observer) => {
    for (const mutation of mutationRecords) {
        switch (mutation.type) {
        case "childList":
            if (mutation.addedNodes.length) debug_log("added nodes", mutation.addedNodes);
            if (mutation.removedNodes.length) debug_log("removed nodes", mutation.removedNodes);
            mutation.addedNodes.forEach(node => {if (!node.__is_gendered && !node.dataset.gngMatch) iterNodes(node, iterReplaceCallback)});
            mutation.removedNodes.forEach(node => iterNodes(node, n => {
                if (n.__gendered_count) {
                    counter -= n.__gendered_count || 0; 
                    n.__gendered_count = 0;
                }
                if (node.nodeType === Node.ELEMENT_NODE) {
                    return true;
                }
            }));
            browser.runtime.sendMessage({setBadge: counter});
            break;
        case "characterData":
            debug_log("changed text node", mutation.target);
            if (mutation.target.nodeType === Node.TEXT_NODE) {
                genderTextNode(mutation.target);
                browser.runtime.sendMessage({setBadge: counter});
            }
            break;
        }
    }
}).observe(document.body, {subtree: true, childList: true, characterData: true});*/
