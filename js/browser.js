var browser = {};

browser.list = function(selection, linkify) {
    var titles = selection
            .selectAll('li.title')
            .data(function(_) { return _; }, function(_) { return _.id; }),
        li = titles.enter().append('li').attr('class', 'title'),
        a = li.append('a');
    a.filter(function(_){return _.id >= 0 }).attr('href', linkify);
    titles.exit().remove();
    
    var nameElement = a.append('span').attr('class', 'name');
    nameElement.html(function(_){
            var number = _.id && _.id >= 0? '<span class="number">'+_.id+'</span>' : '';
            var txt = _.title || _.text || _.description || _.provisions[0].description;//' &nbsp;';
            return number+txt;
        })
    li.filter(function(_){return _.id < 0}).classed('subtitle', true);
    li.filter(function(_){return !(_.title || _.text || _.description);}).attr('style','font-style:italic')
};

var titlesDiv = d3.select('#titles'),
articlesDiv = d3.select('#articles'),
identifierDiv = d3.select('#code-identifier');

d3.select(document)
.call(d3.keybinding('browser')
    .on('←', keyMove(-1))
    .on('→', keyMove(1)));

function articleUrl(titleId) {
    return function(d) { return '#/' + titleId + '/' + d.id; };
}

function updateTitle(titleId, articleId) {
    identifierDiv.text(titleId ? ('§ ' + titleId + (articleId ? '-' +articleId:'')) :  '');
    var baseText = 'اﻟﺩﺳﺘﻮﺭ';
    var titleName;
    var data = titlesDiv.datum();
    for (var idx in data){
        var titleData = data[idx];
        if (titleData.id == titleId){
            titleName = titleData.title.split(':')[0];
        }
    }
    var txt = baseText + ':' + titleName + (articleId ? (',' + 'اﻟفصل' + '-' + articleId) : '')

    d3.select('head').select('title').text(txt);
}



function keyMove(dir) {
    return function() {
        var articles = articlesDiv
            .selectAll('li.title'), i = null;
        articles.each(function(_, ix) {
            if (d3.select(this).classed('active')) i = _.id;
        });
        if (!(i === null || (dir === -1 && i === 0) ||
            (dir === 1 && i === articles[0].length - 1))) {
            articlesDiv.selectAll('li.title').filter(function(_, ix) {
                return +(_.id) == ((+i) + dir);
            }).select('a').trigger('click');
        }
    }
}

function cleanUpArticles(rawArticles, articles){
    var chapters = (rawArticles instanceof Array)? rawArticles : [rawArticles]; 
    if (chapters){
        chapters.map(function(_){
            if (!_) return;
            var article = {id : _['@id'], text : _['#text']}; 
            if (_.Description){
                article.description = _.Description;
            }
            if(_.Categories){
                var categories = (_.Categories instanceof Array) ? _.Categories : [_.Categories];
                article.provisions = categories.map(function(__){
                    var provision = {};
                    if (__.Description){
                        provision.description = __.Description;
                    }
                    if (__.Category){
                        provision.list =__.Category.map(function(___){
                             return (___['#text']) ? ___['#text'] : ___; 
                        }); 
                    }
                    return provision;
                })
            }
            if (_.Additionalinformation){
                article.prepend = _.Additionalinformation;
            }
            articles.push(article);
        }) 
    }; 
}

function cleanUpData(data){
    var subtitleCounter = 0;
    var cleanedUpData = data.Section.map(function(d){
        var e = {id : d.Id, title: d.Title, content : d.Content}; 
        if (d.Content){
            e.content = d.Content; //Preambule only
            var articles = [];
            cleanUpArticles(d.Chapter, articles);
            
            if (d.SubSection) {
                d.SubSection.forEach( function(y){
                    if (!y) return;
                    subtitleCounter +=1;
                    articles.push({kind : 'subtitle', id:'-'+subtitleCounter, title :y.title}); 
                    cleanUpArticles(y.Chapter, articles);
                }) 
            } 

            e.articles = articles; 
            return e} 
    });
    return cleanedUpData;
}

d3.json('data/constitution_ar.json', function(rawData) {
    var cleanedUpData = cleanUpData(rawData);
    titlesDiv.datum(cleanedUpData)
        .call(browser.list, function(_) { return '#/' + _.id });

    var router = Router({
        '#/:title': titles,
        '#/:title/:article': article
    });

    router.init();

    function titles(titleId) {
        titlesDiv.selectAll('li.title')
            .classed('active', false)
            .filter(function(_) { return _.id== titleId; })
            .classed('active', true)
            .node().scrollIntoView();

        listArticles(titleId, cleanedUpData[titleId]);
        d3.select('.titles-container').classed('selected', true);
        d3.select('.articles-container').classed('selected', false);
        updateTitle(titleId,null);
    }

    function articles(titleId, articleId) {
        titles(titleId);
        articlesDiv.selectAll('li.title')
            .classed('active', false)
            .filter(function(_) { return _.id === articleId; })
            .classed('active', true)
            .node().scrollIntoView();
        
        updateTitle(titleId, articleId);
    }

    function article(titleId, articleId) {
        articles(titleId, articleId);

        var articleDiv = d3.select('#article')
            .classed('loading', true);

        data = articlesDiv.datum().filter(function(_){return _.id==articleId})
        articleDiv.classed('loading', false);
        d3.select('.articles-container').classed('selected', true);

        var content = articleDiv.selectAll('div.content')
            .data(data, function(_) { return _.id; });

        content.exit().remove();

        var div = content.enter()
            .append('div')
            .attr('class', 'content')
            .property('scrollTop', 0);

        var h1 = div.append('h2')
            .attr('class', 'pad2')
            
        h1.selectAll("p")
            .data(function(_){var txt = _.text || _.description ; return txt ? txt.split("\n") : '';})
            .enter()
            .append('p')
            .text(function(_) { return _; });
        var article = data[0];
        if (!article.provisions) return ;
        var provisionData = [];
        article.provisions.forEach(function(_){
            if (_.description){
                provisionData.push({level : 'article-1' , text : _.description});
            }
            _.list.forEach(function(__,i){
                provisionData.push({id: i, level :'article-2', text : __});
            });
        })
        if (article.prepend){
            provisionData.push({level : 'article-1' , text : article.prepend});
        }
        var provisionDiv = div.append('h4')
            .attr('class', 'pad2')
        var sections = provisionDiv.append('div').selectAll('section')
            .data(provisionData)
            .enter()
            .append('section')
            .attr('class', function(d){return d.level;});
            sections.append('p')
                .append('span')
                .text(function(d){return d.text});
    }

    function listArticles(titleId, titleData) {
        // handle the preambule case separately
        var data = titleData.id !== 'undefined' && titleData.id == 0 ? [{id:"0",text:titleData.content}] : titleData.articles;
        articlesDiv.datum(data)
            .call(browser.list, articleUrl(titleId));
    }
});
