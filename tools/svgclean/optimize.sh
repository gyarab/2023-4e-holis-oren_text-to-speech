#!/bin/sh

mkdir -p icons-{new,opt}

for f in icons-new/*.svg
do
	name=`basename "$f"`
	svgcleaner --allow-bigger-file --indent=2 --apply-transform-to-paths=yes --multipass "$f" "icons-opt/$name"
done