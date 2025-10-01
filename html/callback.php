<?php

declare(strict_types=1);

function json_encode_vb($data) {
	return json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

header('HTTP/1.1 200 Ok');
$a = !empty($_REQUEST['a']) ? $_REQUEST['a'] : '';
$rv = [
	'a' => $a,
	'errors' => [],
	];

$origin = '*';
if (!empty($_SERVER['HTTP_ORIGIN'])) {
	$origin = trim($_SERVER['HTTP_ORIGIN']);
}
header('Access-Control-Allow-Origin: '.$origin);
header('Access-Control-Allow-Credentials: true');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
	header('HTTP/1.1 200 Options');
	die();
}

while ($a === 'cs') {
	$ana = trim($_REQUEST['ana'] ?? '');
	if (!preg_match('~^\w~u', $ana)) {
		$rv['errors'][] = 'Invalid analysis';
		break;
	}

	$rv['ana'] = $ana;
	$ana = escapeshellarg($ana);
	$out = explode("\n", trim(shell_exec("echo $ana | /home/tino/apertium/hfst/tools/src/hfst-optimized-lookup -p /home/tino/langtech/kal/src/fst/generator-gt-norm.hfstol | sort | uniq"), " \r\n\v\0"));
	if ($out[0][0] === "\t") {
		$rv['cs'] = $out[0];
		$rv['cs'] = preg_replace('~\t[+]~u', ' ', $rv['cs']);
		$rv['cs'] = preg_replace('~[+]Der/~u', '+', $rv['cs']);
		$rv['cs'] = explode(' ', trim($rv['cs']));
		array_shift($out);
	}
	if (strpos($out[0], '+?') === false) {
		$rv['gen'] = [];
		foreach ($out as $o) {
			if (preg_match('~^[^\t]+\t\w+~u', $o)) {
				$rv['gen'][] = $o;
			}
		}
	}

	break;
}

if (!empty($rv['errors'])) {
	header('HTTP/1.1 400 Bad Request');
}
else {
	unset($rv['errors']);
}

header('Content-Type: application/json');

echo json_encode_vb($rv);
