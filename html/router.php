<?php

if (php_sapi_name() != 'cli-server') {
	exit(1);
}

if (preg_match('~\.(?:png|jpg|html|js|mjs|css)$~', $_SERVER['REQUEST_URI'])) {
	return false;
}
if (preg_match('~\.(?:sqlite)$~', $_SERVER['REQUEST_URI'])) {
	header('Content-Type: application/vnd.sqlite3');
	header('Content-Encoding: gzip');
	header('Content-Length: '.filesize('predict.sqlite.gz'));
	readfile('predict.sqlite.gz');
	return true;
}
if (preg_match('~callback.php~', $_SERVER['REQUEST_URI'])) {
	require_once 'callback.php';
	return true;
}

require_once 'index.html';
