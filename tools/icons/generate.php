<?php

$icons_dir = getenv('ICONS_DIR', true);
$icons_out_js = getenv('ICONS_OUT_JS', true);
$icons_out_svg = getenv('ICONS_OUT_SVG', true);
$icons_out_sass = getenv('ICONS_OUT_SASS', true);

$symbols = new DOMDocument();
$symbols->formatOutput = true;
$symbols_root = $symbols->createElementNS('http://www.w3.org/2000/svg', 'svg');
$symbols_root->setAttribute('version', '1.1');
$symbols_root->setAttribute('id', 'icons');
$symbols_root->setAttribute('style', 'height: 0; width: 0; position: absolute; visibility: hidden;');
$symbols->appendChild($symbols_root);

$icon_sizes = [];
foreach (new DirectoryIterator($icons_dir) as $f) {
	if (!$f->isFile() || !preg_match('#\.svg$#', $f->getFilename()))
		continue;
	
	$id = $f->getBasename('.svg');
	$icon = new DOMDocument();
	$icon->loadXML(file_get_contents($f->getPathname()));
	$vb = $icon->documentElement->getAttribute('viewBox');
	$vbp = explode(' ', $vb);
	$icon_sizes[$id] = [$vb, (float)$vbp[2], (float)$vbp[3]];

        // add to the symbols file

	$sym = $symbols->createElement('symbol');
	$sym->setAttribute('id', 'icon-' . $id);
	$sym->setAttribute('viewBox', $vb);
	$symbols_root->appendChild($sym);

	for ($c = $icon->documentElement->firstChild; $c; $c = $c->nextSibling)
		$sym->appendChild($symbols->importNode($c, true));
}

$sass_table = "\$icon-sizes: (";
foreach ($icon_sizes as $k => $v)
	$sass_table.= "\"$k\": " . $v[1] . ' ' . $v[2] . ", ";
$sass_table.= ")\n";

file_put_contents($icons_out_svg, preg_replace('#<\?xml.*\?>\\n#', '', $symbols->saveXML()));
file_put_contents($icons_out_js, 'ICON_SIZES = ' . json_encode((object)$icon_sizes) . ";");
file_put_contents($icons_out_sass, $sass_table);
