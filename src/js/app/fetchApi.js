"use strict";

var canvas = global.canvas;
var config = require('./config.js');

/* ---- callbacks ---- */
var toggleSpinner, toggleNoResults, resultsDiv, actionHandler;

/* ---- search state ---- */
var keyword = "";
var outstandingQueries = [];
var numResults = 0;
var numPages = 0;
var currentPage = 0;
var pageSize = 0;
var loading = false;
var urls = {};
var cachedResults = null;

function queryNounApi(page, numResults, callback) {
  var endpoint = config.icons.host;

  if (cachedResults === null) {
    var xhr = $.ajax({
      url: endpoint,
      data: {
        t: keyword
      },
      success: function(response) {
        var icons = JSON.parse(response);
        var totalResults = icons.length;

        var payload = [];
        for (var i = 0; i < totalResults; i++) {
          var thisId = icons[i][0];
          var folder = parseInt(thisId/1000);
          payload.push({
            id: thisId,
            title: icons[i][1],
            uploader: icons[i][2],
            uploader_url: icons[i][3],
            svg: {
              url: endpoint + "/svg/" + folder + "/" + thisId + ".svg",
              png_thumb: endpoint + "/png/" + folder + "/" + thisId + ".png"
            }
          });
        }
        cachedResults = payload;
        var thisPage = payload.slice(0, numResults);
        callback(thisPage, thisPage.length, Math.ceil(payload.length/numResults), page, true);
      }
    });
    outstandingQueries.push(xhr);
  } else {
    var thisPage = cachedResults.slice((page-1)*numResults,((page-1)*numResults)+numResults);
    var allPages = Math.ceil(cachedResults.length/numResults);
    callback(thisPage, thisPage.length, allPages, page, true);
  }
}

function queryClipartApi(page, numResults, callback) {
  var clipartAPI = "//openclipart.org/search/json/";
  var xhr = $.ajax({
    url: clipartAPI,
    jsonp: "callback",
    dataType: "jsonp",
    data: {
      query: keyword,
      amount: numResults,
      sort: "downloads",
      page: page
    },
    success: function(response) {
      var i = response.info;
      callback(response.payload, i.results, i.pages, i.current_page, false);
    }
  });
  outstandingQueries.push(xhr);
}

function queryBitvaxApi(page, numResults, callback) {
  var endpoint = "/en/artwork";

  if (cachedResults === null) {
    var xhr = $.ajax({
      url: endpoint,
      data: {
        t: keyword
      },
      success: function(response) {
        var get_icons = function(categories){
          var res = [];
          for (var categoriesKey in categories) {
            var category=categories[categoriesKey];
            if (category.products.length > 0)  res=[].concat(res,
                category.products.map(function(x){x.category= {'name':category.name,'id':category.id}; return x;}));
            if (category.categories.length > 0) res=[].concat(res,get_icons(category.categories));
          }
          return res;
        };
        var icons = get_icons(response);
        var totalResults = icons.length;
        var payload = [];
        for (var i = 0; i < totalResults; i++) {
          var thisId = icons[i]['id'];
          // var folder = parseInt(thisId/1000);
          payload.push({
            id: thisId,
            title: icons[i]['name'],
            uploader: icons[i]['category']['name'],
            uploader_url: icons[i][3],
            svg: {
              url: icons[i]['image'].replace(".jpg",".svg"),
              png_thumb: icons[i]['thumbnail']
            }
          });
        }
        cachedResults = payload;
        var thisPage = payload.slice(0, numResults);
        callback(thisPage, thisPage.length, Math.ceil(payload.length/numResults), page, true);
      }
    });
    outstandingQueries.push(xhr);
  } else {
    var thisPage = cachedResults.slice((page-1)*numResults,((page-1)*numResults)+numResults);
    var allPages = Math.ceil(cachedResults.length/numResults);
    callback(thisPage, thisPage.length, allPages, page, true);
  }
}

function loadMore(_nouns) {
  if (currentPage === numPages) {
    return;
  } else if (loading === true) {
    return;
  }

  // Load results
  loading = true;
  currentPage += 1;
  toggleSpinner(true);

  if (_nouns === true) {
    queryNounApi(currentPage, pageSize, function(results, _numResults, _pages, _currentPage) {
      currentPage = _currentPage;
      displayResults(results);
      toggleSpinner(false);
      loading = false;
    });
  } else {
    queryClipartApi(currentPage, pageSize, function(results, _numResults, _pages, _currentPage) {
      currentPage = _currentPage;
      displayResults(results);
      toggleSpinner(false);
      loading = false;
    });
  }
}

function displayResults(results) {
  for (var i = 0; i < results.length ; i++) {
    var image = results[i];
    var id = image.id;
    urls[id] = image.svg.url;

    var title, source, source_href, user_href;
    if ("total_favorites" in image) {
      // Openclipart
      title = null;
      source = "Openclipart";
      source_href = "https://data.daringlogos.com/redirect?url=http://openclipart.org";
      user_href = "https://data.daringlogos.com/redirect?url=http://openclipart.org/user-detail/" + image.uploader;
    } else {
      // Noun Project
      title = image.title;
      source = "The Noun Project";
      source_href = "https://data.daringlogos.com/redirect?url=http://thenounproject.com";
      user_href = "https://data.daringlogos.com/redirect?url=http://thenounproject.com" + image.uploader_url;
    }

    var attribution = '<br/>';
    if (title !== null && title !== "") {
      attribution += "<strong style='text-transform: capitalize;'>" + title + "</strong><br/><br/>";
    }
    attribution += "By <a target='_blank' href='" + user_href + "'>";
    attribution += image.uploader + "</a> From <a target='_blank' href='" + source_href + "'>" + source + "</a><br/>&nbsp;";

    resultsDiv.append('<img class="preview-image tooltip" title="' + attribution + '" src="' + image.svg.png_thumb + '" id="' + id + '">');
  }

  // Show attribution tooltips
  $('.tooltip').tooltipster({
    theme: 'tooltipster-light',
    contentAsHTML: true,
    animation: 'grow',
    delay: 50,
    speed: 150,
    maxWidth: 250,
    hideOnClick: true,
    interactive: true,
    interactiveTolerance: 350,
    onlyOne: true,
    position: 'right'
  });

  resultsDiv.off("click.insertimage");
  resultsDiv.on("click.insertimage", ".preview-image", function(e) {
    var url = urls[e.currentTarget.id];
    actionHandler(url);
  });
}

function cancelOutstandingQueries() {
  for (var i = 0; i < outstandingQueries.length; i++) {
    outstandingQueries[i].abort();
  }
}

function parseResults(results, _numResults, _numPages, _currentPage, _nouns) {
  // Metadata
  numResults = _numResults;
  numPages = _numPages;
  currentPage = _currentPage;

  // Process results
  toggleSpinner(false);
  if (_numResults === 0) {
    toggleNoResults(true);
    return;
  }

  // Populate previews
  displayResults(results);

  // Setup scroll handler
  if (_numPages > 1) {
    resultsDiv.on("scroll.scrollHandler", function(){
      if($(this).scrollTop() + $(this).innerHeight() >= $(this)[0].scrollHeight){
        loadMore(_nouns);
      }
    });
  }
}

function parseResultsBitvax(results) {

}

function search(_keyword, _toggleSpinner, _toggleNoResults, _resultsDiv, _actionHandler, _clipart) {
  keyword = _keyword.trim();
  if (keyword === "") {
    return;
  }

  // Cancel all outstanding queries
  cancelOutstandingQueries();
  outstandingQueries.length = 0;

  // callbacks
  toggleSpinner = _toggleSpinner;
  toggleNoResults = _toggleNoResults;
  resultsDiv = _resultsDiv;
  actionHandler = _actionHandler;

  // Clear search results
  resultsDiv.off("scroll.scrollHandler");
  resultsDiv.children(".preview-image").remove();

  // Reset
  loading = false;
  urls = {};

  // Query API
  toggleSpinner(true);
  pageSize = Math.ceil((window.innerHeight - 50) / 100) * 3;

  if (_clipart === 'clipart') {
    queryClipartApi(1, pageSize, parseResults);
  }else if (_clipart === 'Bitvax'){
    queryBitvaxApi(1, pageSize, parseResults);
  }else {
    cachedResults = null;
    queryNounApi(1, pageSize, parseResults);
  }

}

/* ----- exports ----- */

function FetchApiModule() {
  if (!(this instanceof FetchApiModule)) return new FetchApiModule();
}

FetchApiModule.prototype.search = search;
FetchApiModule.prototype.queryBitvaxApi = queryBitvaxApi;

module.exports = FetchApiModule;
