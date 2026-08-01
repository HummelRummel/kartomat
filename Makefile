index.html: kartomat.template.html manifest.json scripts/build.py scripts/sw.template.js src/jpeg-comment-codec.js
	python3 scripts/build.py

.PHONY: clean index.html
clean:
	rm -f index.html sw.js
