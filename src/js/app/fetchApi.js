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


function get_search(categories,search) {
  var res = [];
  for (var categoriesKey in categories) {
    var category = categories[categoriesKey];
    if (category.products.length > 0)
      res = [].concat(res,
          category.products.filter(function (x){
            return x.names.toLowerCase().indexOf(search.toLowerCase()) !== -1})
              .map(function (x) {
                    x.category = {'name': category.name, 'id': category.id};
                    return x })
      );
    if (Object.keys(category.categories).length > 0) res = [].concat(res, get_search(category.categories,search));
  }
  return res;
};

function getBitvaxData(prepareCallback){
  var endpoint = config.icons.host+"/"+global.store+"/artwork";
  function success_callback(response) {
    global.data = response;
    prepareCallback(response);
  }

  if (global.data == null) {
    var xhr = $.ajax({
      url: endpoint,
      data: {
        t: keyword
      },
      success: success_callback
    });
    outstandingQueries.push(xhr);
  } else {
    success_callback(global.data);
  }

}

function queryBitvaxApi(page, numResults, callback ) {
  if (cachedResults === null) {
    getBitvaxData(function (response){
      cachedResults = get_search(keyword===""?[response[0]]:response, keyword);
      var thisPage = cachedResults.slice(0, numResults);
      callback(thisPage, thisPage.length, Math.ceil(cachedResults.length / numResults), page);
    });
  } else {
    var thisPage = cachedResults.slice((page-1)*numResults,((page-1)*numResults)+numResults);
    var allPages = Math.ceil(cachedResults.length/numResults);
    callback(thisPage, thisPage.length, allPages, page);
  }
}

function loadMore() {
  if (currentPage === numPages) {
    return;
  } else if (loading === true) {
    return;
  }

  // Load results
  loading = true;
  currentPage += 1;
  toggleSpinner(true);

  queryBitvaxApi(currentPage, pageSize, function(results, _numResults, _pages, _currentPage) {
      currentPage = _currentPage;
      displayResults(results);
      toggleSpinner(false);
      loading = false;
    });
}

function displayResults(results) {
  for (var i = 0; i < results.length ; i++) {
    var image = results[i];
    urls[image.id] = config.icons.host+image.image.replace(".jpg", ".svg");

    // var title, source, source_href, user_href;
    //   // Noun Project
    //   title = image.title;
    //   source = "Acesticker";
    //   source_href = "https://www.acesticker.com";
    //   user_href = "https://www.acesticker.com" + image.uploader_url;

    // var attribution = '';
    // if (title !== null && title !== "") {
    //   attribution += "<strong>" + image.name + "</strong>";
    // }
    // attribution += "By <a target='_blank' href='" + user_href + "'>";
    // attribution += image.uploader + "</a> From <a target='_blank' href='" + source_href + "'>" + source + "</a><br/>&nbsp;";

    resultsDiv.append('<img class="preview-image tooltip" title="' + image.name + '" src="' + image.thumbnail + '" id="' + image.id + '">');
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

function parseResults(results, _numResults, _numPages, _currentPage) {
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
        loadMore();
      }
    });
  }
}

function getPageSize() {
  return Math.ceil((window.innerHeight - 50) / 35) * 4;
}

function search(_keyword, _toggleSpinner, _toggleNoResults, _resultsDiv, _actionHandler) {
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
  cachedResults=null;

  // Reset
  loading = false;
  urls = {};

  // Query API
  toggleSpinner(true);
  pageSize = getPageSize();
  queryBitvaxApi(1, pageSize, parseResults);
}

function load(_toggleSpinner, _toggleNoResults, _resultsDiv, _actionHandler) {
  if (cachedResults!=null){
    return;
  }
  keyword = '';
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
  cachedResults=null;

  // Reset
  loading = false;
  urls = {};

  // Query API
  toggleSpinner(true);
  pageSize = getPageSize();
  queryBitvaxApi(1, pageSize, parseResults);
}

/* ----- exports ----- */

function FetchApiModule() {
  if (!(this instanceof FetchApiModule)) return new FetchApiModule();
  getBitvaxData(function (response){});
  // getBitvaxData(function (response){
  //   cachedResults = get_search([response[0]], '');
  //   var nResults=getPageSize();
  //   var thisPage = cachedResults.slice(0, nResults);
  //   parseResults(thisPage, thisPage.length, Math.ceil(cachedResults.length / nResults), 1);
  // });

}

FetchApiModule.prototype.search = search;
FetchApiModule.prototype.load = load;

module.exports = FetchApiModule;
