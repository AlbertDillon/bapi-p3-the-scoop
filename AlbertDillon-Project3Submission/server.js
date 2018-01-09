var yaml = require('write-yaml');
var readYaml = require('read-yaml');

// database is let instead of const to allow us to modify it in test.js

let database = {
	users: {},
	articles: {},
	nextArticleId: 1,
	comments: {},
	nextCommentId: 1
};

const routes = {
	'/users': {
		'POST': getOrCreateUser
	},
	'/users/:username': {
		'GET': getUser
	},
	'/articles': {
		'GET': getArticles,
		'POST': createArticle
	},
	'/articles/:id': {
		'GET': getArticle,
		'PUT': updateArticle,
		'DELETE': deleteArticle
	},
	'/articles/:id/upvote': {
		'PUT': upvoteArticle
	},
	'/articles/:id/downvote': {
		'PUT': downvoteArticle
	},
	'/comments': {
		'POST': createComment
	},
	'/comments/:id': {
		'PUT': updateComment,
		'DELETE': deleteComment
	},
	'/comments/:id/upvote': {
		'PUT': upvoteComment
	},
	'/comments/:id/downvote': {
		'PUT': downvoteComment
	}
};

/*
Called on 'POST' request.
Checks validity of comment request.
Creates an object in database.comments[] with data from request.
Returns comment body and/or status for un/successful comment creation.
*/
function createComment(url, request) {
	const response = {};
	let requestComment;
	if (request.body && request.body.comment) { // Exist and defined.
		requestComment = request.body.comment;
	}
	
	if (requestComment && requestComment.body && requestComment.username &&
		database.users[requestComment.username] && requestComment.articleId &&
		database.articles[requestComment.articleId]) { // Exist and defined.
		
		const comment = {
			id: database.nextCommentId++, // Number, unique to each comment
			body: requestComment.body, // String
			username: requestComment.username, // String, the username of the author
			articleId: requestComment.articleId, // Number, the ID of the article the comment belongs to
			upvotedBy: [], // Array of usernames, corresponding to users who upvoted the comment
			downvotedBy: [] // Array of usernames, corresponding to users who downvoted the comment
		};
		
		database.comments[comment.id] = comment;
		database.users[comment.username].commentIds.push(comment.id);
		database.articles[comment.articleId].commentIds.push(comment.id);
		
		response.body = {comment: comment};
		response.status = 201; // Created.
		
	} else {
		response.status = 400; // Bad request.
	}
	
	return response;
}

/*
Called on 'PUT' request.
Checks validity of comment request.
Modifies an object in database.comments[] with data from request.
Returns comment body and/or status for un/successful comment update.
*/
function updateComment(url, request) {
	const id = Number(url.split('/').filter(segment => segment)[1]);
	const savedComment = database.comments[id];
	
	const requestComment = request.body && request.body.comment;
	const response = {};

	if (!id || !requestComment) { // Invalid request and/or syntax
		response.status = 400; // Bad request.
		
	} else if (!savedComment) { // No such object is defined.
		response.status = 404; // Not found.
		
	} else { // Valid and defined.
		savedComment.body = requestComment.body || savedComment.body;
		database.comments[id] = savedComment;
		
		response.body = {comment: savedComment};
		response.status = 200; // OK.
	}
	
	return response;
}

/*
Called on 'DELETE' request.
Checks if comment exists.
Deletes object in database.comments[].
Returns status for un/successful comment deletion.
*/
function deleteComment(url, request) {
	const id = Number(url.split('/').filter(segment => segment)[1]);
	const savedComment = database.comments[id];
	const response = {};
	
	if (savedComment) { // Exist and defined.
		let savedUser = database.users[savedComment.username];
		let savedArticle = database.articles[savedComment.articleId];
		
		savedUser.commentIds = savedUser.commentIds.filter(element => element !== id);
		savedArticle.commentIds = savedArticle.commentIds.filter(element => element !== id);
		
		database.comments[id] = null;
		response.status = 204; // No content.
		
	} else { // Undefined.
		response.status = 404; // Not found.
	}
	
	return response;
}

/*
Called on 'PUT' request.
Checks validity of request.
Modifies database.comments[].upvotedBy (may also edit database.comments[].downvotedBy)
by call to upvote().
Returns status for un/successful comment appraisal.
*/
function upvoteComment(url, request) {
	const id = Number(url.split('/').filter(segment => segment)[1]);
	const username = request.body && request.body.username;
	
	let savedComment = database.comments[id];
	const response = {};
	
	if (savedComment && database.users[username]) { // Exist and defined.
		savedComment = upvote(savedComment, username);
		
		response.body = {comment: savedComment};
		response.status = 200; // OK.
		
	} else {
		response.status = 400; // Bad request.
	}
	
	return response;
}

/*
Called on 'PUT' request.
Checks validity of request.
Modifies database.comments[].downvotedBy (may also edit database.comments[].upvotedBy)
by call to downvote().
Returns status for un/successful comment depreciation.
*/
function downvoteComment(url, request) {
	const id = Number(url.split('/').filter(segment => segment)[1]);
	const username = request.body && request.body.username;
	
	let savedComment = database.comments[id];
	const response = {};
	
	if (savedComment && database.users[username]) {
		savedComment = downvote(savedComment, username);
		response.body = {comment: savedComment};
		response.status = 200; // OK.
	} else {
		
		response.status = 400; // Bad request.
	}
	
	return response;
}


function getUser(url, request) {
  const username = url.split('/').filter(segment => segment)[1];
  const user = database.users[username];
  const response = {};

  if (user) {
    const userArticles = user.articleIds.map(
        articleId => database.articles[articleId]);
    const userComments = user.commentIds.map(
        commentId => database.comments[commentId]);
    response.body = {
      user: user,
      userArticles: userArticles,
      userComments: userComments
    };
    response.status = 200;
  } else if (username) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function getOrCreateUser(url, request) {
  const username = request.body && request.body.username;
  const response = {};

  if (database.users[username]) {
    response.body = {user: database.users[username]};
    response.status = 200;
  } else if (username) {
    const user = {
      username: username,
      articleIds: [],
      commentIds: []
    };
    database.users[username] = user;

    response.body = {user: user};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function getArticles(url, request) {
  const response = {};

  response.status = 200;
  response.body = {
    articles: Object.keys(database.articles)
        .map(articleId => database.articles[articleId])
        .filter(article => article)
        .sort((article1, article2) => article2.id - article1.id)
  };

  return response;
}

function getArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const article = database.articles[id];
  const response = {};

  if (article) {
    article.comments = article.commentIds.map(
      commentId => database.comments[commentId]);

    response.body = {article: article};
    response.status = 200;
  } else if (id) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function createArticle(url, request) {
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (requestArticle && requestArticle.title && requestArticle.url &&
      requestArticle.username && database.users[requestArticle.username]) {
    const article = {
      id: database.nextArticleId++,
      title: requestArticle.title,
      url: requestArticle.url,
      username: requestArticle.username,
      commentIds: [],
      upvotedBy: [],
      downvotedBy: []
    };

    database.articles[article.id] = article;
    database.users[article.username].articleIds.push(article.id);

    response.body = {article: article};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function updateArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (!id || !requestArticle) {
    response.status = 400;
  } else if (!savedArticle) {
    response.status = 404;
  } else {
    savedArticle.title = requestArticle.title || savedArticle.title;
    savedArticle.url = requestArticle.url || savedArticle.url;

    response.body = {article: savedArticle};
    response.status = 200;
  }

  return response;
}

function deleteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const response = {};

  if (savedArticle) {
    database.articles[id] = null;
    savedArticle.commentIds.forEach(commentId => {
      const comment = database.comments[commentId];
      database.comments[commentId] = null;
      const userCommentIds = database.users[comment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);
    });
    const userArticleIds = database.users[savedArticle.username].articleIds;
    userArticleIds.splice(userArticleIds.indexOf(id), 1);
    response.status = 204;
  } else {
    response.status = 400;
  }

  return response;
}

function upvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = upvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function downvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = downvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function upvote(item, username) {
  if (item.downvotedBy.includes(username)) {
    item.downvotedBy.splice(item.downvotedBy.indexOf(username), 1);
  }
  if (!item.upvotedBy.includes(username)) {
    item.upvotedBy.push(username);
  }
  return item;
}

function downvote(item, username) {
  if (item.upvotedBy.includes(username)) {
    item.upvotedBy.splice(item.upvotedBy.indexOf(username), 1);
  }
  if (!item.downvotedBy.includes(username)) {
    item.downvotedBy.push(username);
  }
  return item;
}

function loadDatabase() {
	readYaml('database.yml', function(err,data) {
		if (err) {
			console.log(err);
	}})
}

function saveDatabase() {
	yaml('database.yml', database, function(err) {
		if (err) {
			console.log(err);
		}
	})
}

// Write all code above this line.

const http = require('http');
const url = require('url');

const port = process.env.PORT || 4000;
const isTestMode = process.env.IS_TEST_MODE;

const requestHandler = (request, response) => {
  const url = request.url;
  const method = request.method;
  const route = getRequestRoute(url);

  if (method === 'OPTIONS') {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
    response.writeHead(200, headers);
    return response.end();
  }

  response.setHeader('Access-Control-Allow-Origin', null);
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader(
      'Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (!routes[route] || !routes[route][method]) {
    response.statusCode = 400;
    return response.end();
  }

  if (method === 'GET' || method === 'DELETE') {
    const methodResponse = routes[route][method].call(null, url);
    !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

    response.statusCode = methodResponse.status;
    response.end(JSON.stringify(methodResponse.body) || '');
  } else {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = JSON.parse(Buffer.concat(body).toString());
      const jsonRequest = {body: body};
      const methodResponse = routes[route][method].call(null, url, jsonRequest);
      !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

      response.statusCode = methodResponse.status;
      response.end(JSON.stringify(methodResponse.body) || '');
    });
  }
};

const getRequestRoute = (url) => {
  const pathSegments = url.split('/').filter(segment => segment);

  if (pathSegments.length === 1) {
    return `/${pathSegments[0]}`;
  } else if (pathSegments[2] === 'upvote' || pathSegments[2] === 'downvote') {
    return `/${pathSegments[0]}/:id/${pathSegments[2]}`;
  } else if (pathSegments[0] === 'users') {
    return `/${pathSegments[0]}/:username`;
  } else {
    return `/${pathSegments[0]}/:id`;
  }
}

if (typeof loadDatabase === 'function' && !isTestMode) {
  const savedDatabase = loadDatabase();
  if (savedDatabase) {
    for (key in database) {
      database[key] = savedDatabase[key] || database[key];
    }
  }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    return console.log('Server did not start succesfully: ', err);
  }

  console.log(`Server is listening on ${port}`);
});