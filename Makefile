kartomat.html: kartomat.template.html scripts/build.py
	python3 scripts/build.py

.PHONY: clean kartomat.html
clean:
	rm -f kartomat.html
