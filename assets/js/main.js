console.log("main.js loaded");
var db;
// Initialize Firebase
try {
    var config = firebaseConfig;
    firebase.initializeApp(config);
    db = firebase.database();
    console.log('Successfully initialized database');
} catch {
    console.log('Failed to initialize database');
}

// Initialize Sentimood
var sentimood = new Sentimood();

// results per source -- keep 1-2 for testing, ~5-10 when ready to demo
var resultsPerSource = 2; 

var searchParam = $("#search-term").val().trim();
var currentTopic;


class Topic {
    constructor(queryString, timestamp=null, articleResults=null) {
        this.queryString = queryString;
        // hard-coded sources
        this.sources = ["cnn","fox-news","the-huffington-post","bbc-news","breitbart-news","vice-news"];
        // timestamp 
        this.timestamp = this.setTimestamp(timestamp);
        // actual article results with individual sentiment scores
        this.articleResults = this.setArticleResults(articleResults);
        // aggregate sentiment scores
        // not implemented yet
        // this.highSentimentArticle;
        // this.lowSentimentArticle;
    }

    setTimestamp(timestamp) {
        if (!timestamp) {
            return new Date().getTime();
        } else {
            return timestamp;
        }
        
    }

    setArticleResults(articleResults) {
        if (!articleResults) {
            return [];
        } else {
            return articleResults;
        }
    }

    getSentimentScores() {
        var res = [];
        // each source, loop through and is the article source matches, sum sentiment score
        for (let i = 0; i < this.sources.length; i++) {
            let sum = 0;
            let count = 0;
            let aggScore = {};
            // issue here
            for (var j = 0; j < this.articleResults.length; j++) {
                if (this.sources[i] === this.articleResults[j].source.id) {
                    sum += this.articleResults[j].sentiment;
                    count++;
                }
            }
            aggScore[this.sources[i]] = sum / count;
            res.push(aggScore);
        }
        return res;

    }
        
    populateResults() {
        $('#aggDisplay td').empty();
        
        
        var data = this.getSentimentScores();
        console.log(data);
        if(data.length < 1) {
             // modal window pop-up

         } else {   //{cnn:1.5}
            for (var i = 0; i < data.length; i++) {
                let val = Object.values(data[i])[0];
                let valDisplay = $('<span>');
                if (val >= 3) {
                    valDisplay.css({'color':'green', 'font-size':'30px'});
                } else if (val <= -3) {
                    valDisplay.css({'color':'red', 'font-size':'30px'});
                } else {
                    valDisplay.css({'font-size':'30px'});
                }

                valDisplay.text(val);

                switch (Object.keys(data[i])[0]) {
            
                    case "cnn": 
                        $("#cnn").append(valDisplay);
                        break;

                    case "fox-news":
                        $("#fox").append(valDisplay);
                        break;

                    case "the-huffington-post":
                        $("#huff").append(valDisplay);
                        break;

                    case "bbc-news":
                        $("#bbc").append(valDisplay);
                        break;

                    case "breitbart-news":
                        $("#breit").append(valDisplay);
                        break;

                    case "vice-news": 
                        $("#vice").append(valDisplay);
                        break;

                }
            }
        }
    }

    populateMaxMinArticles() {
        $('#high-article-section').empty();
        $('#low-article-section').empty();
        var maxArticles = [];
        var minArticles = [];
        
        function articleFormat(article, type) {
            var articleCard = $('<div>');
            articleCard.addClass(['row']);
            articleCard.css({'padding-bottom':'20px'});
            var articleImg = $('<img/>');
            articleImg.attr({'src':article.urlToImage, 'alt':'Article Image'});
            articleImg.addClass(["img", "col-sm-4"]);
            articleImg.css({'width':'200px', 'max-height':'100px'});
            var articleDetails = $('<div>');
            articleDetails.addClass("col-sm-8");
            
            var scorePill = $('<span>');
            scorePill.addClass(['badge', 'badge-pill', 'badge-danger']);
            scorePill.text('SentiScore: ' + article.sentiment);

            var lineBreak = $('<br>');

            var articleSource = $('<p>');
            articleSource.css({'font-weight':'bold', 'margin-bottom':"0px"});
            articleSource.text(article.source.name);


            var articleTitle = $('<a>');
            articleTitle.attr({'href':article.url});
            articleTitle.text(article.title);
            
            articleDetails.append([scorePill, articleSource, articleTitle]);
            articleCard.append([articleImg, articleDetails]);

            if (type == 'high') {
                $('#high-article-section').append(articleCard);
            } else if (type == 'low') {
                $('#low-article-section').append(articleCard);
            }

        }
        
        for (var i = 20; i >= -20; i--) {
            for (var j = 0; j < this.articleResults.length; j++) {
                if (this.articleResults[j].sentiment === i && maxArticles.length <= 2) {
                    maxArticles.push(this.articleResults[j]);
                } else if (this.articleResults[j].sentiment === (i * -1) && minArticles.length <= 2) {
                    minArticles.push(this.articleResults[j]);
                }
            }    
        }
        
        // TODO - iterate through maxArticles & maxArticles and add them to the appropriate html elements
        for (var i=0; i < maxArticles.length; i++) {
            articleFormat(maxArticles[i], 'high');
        }

        for (var i=0; i < minArticles.length; i++) {
            articleFormat(minArticles[i], 'low');
        }
        
        console.log(maxArticles);
        console.log(minArticles);
    }
    
    commit() {
        db.ref('/topic').push(this).then((snapshot) => {
            currentTopic = snapshot.key;
        });
        return 0;
    }

    querySource(articleResults) {
        if (articleResults) {
            return articleResults;
        } else {
            // Combine Kevin's code
            var baseURL = "https://newsapi.org/v2/everything?pageSize=" + resultsPerSource + "&apiKey=" + newsApiKey +  "&q=" + this.queryString + "&sources=";
            var res = [];
            var prom = []; 
            var that = this;
            for (let i = 0; i < this.sources.length; i++) {
                var source = this.sources[i];
                var newResp = $.ajax({
                    url: (baseURL + source),
                    method: "GET"
                });
                prom.push(newResp);
                //console.log(newResp);
            };

            Promise.all(prom).then(function(vals) {
                for (let v = 0; v < vals.length; v++) {
                    for (let j = 0; j < vals[v].articles.length; j++) {
                        let articleString = vals[v].articles[j].title + " " + vals[v].articles[j].description        
                        vals[v].articles[j].sentiment = sentimood.analyze(articleString).score;
                        that.articleResults.push(vals[v].articles[j]);
                    }
                    
                }
                console.log(that.articleResults);
                that.commit();
                that.populateResults();
                that.populateMaxMinArticles();
            });
            
            // return res;    
        }
    }
    
    getTimestamp() {
        return this.timestamp;
    }
}

$("#run-search").on("click", function(event){

    event.preventDefault();
    var searchParam = $("#search-term").val().trim();
    // var articles = articleResults; 

    if (searchParam === ""){
        console.log("search can't be null");
        $('#queryModal').modal('show'); 
    
    } else {
        var topic = new Topic(searchParam);
        topic.querySource()
        // if (topic.articleResults === undefined || topic.articleResults.length === 0){
        // $('#nullModal').modal('show'); 
        // }
    }
});

db.ref('topic').on("child_added", function(snapshot) {
    var newItem = $('<button>');
    newItem.text(snapshot.val().queryString)
    newItem.val(snapshot.key);
    newItem.addClass(["btn", "btn-success"]);
    newItem.css('margin', '10px');
    $('#recent-searches').prepend(newItem);
    
       
});

$("body").on("click", '#recent-searches .btn', function(event) {
    event.preventDefault();
    db.ref('topic').child($(this).val()).once('value').then(function(snap) {
        var record = snap.val();
        var topic = new Topic(record.queryString, record.timestamp, record.articleResults);
        topic.populateResults();
        topic.populateMaxMinArticles();
    });
    
    
});

document.getElementById("date").innerHTML = formatAMPM();

function formatAMPM() {
var d = new Date(),
    minutes = d.getMinutes().toString().length == 1 ? '0'+d.getMinutes() : d.getMinutes(),
    hours = d.getHours().toString().length == 1 ? '0'+d.getHours() : d.getHours(),
    ampm = d.getHours() >= 12 ? 'pm' : 'am',
    months = ['January','Feb','Mar','Apr','May','Jun','July','Aug','Sep','Oct','Nov','Dec'],
    days = ['Sun','Mon','Tue','Wed','Thursday','Fri','Sat'];
return days[d.getDay()]+ ' ,' + ' '+months[d.getMonth()]+' '+d.getDate()+' '+d.getFullYear();
}

