import {build_word} from './builder.mjs';

let tests = {
	'aallariartorsinnaannginnera': ['aallar', 'GIARTUR+vv', 'SINNAA+vv', 'NNGIT+vv', 'NIQ+vn', 'N', 'Abs', 'Sg', '1SgPoss'],
	};

for (let k in tests) {
	let t = tests[k];
	let rv = build_word(t);
	if (rv !== k) {
		console.log(`'${t}' yielded '${rv}', not '${k}' !`);
	}
}
