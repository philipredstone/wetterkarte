

all:
	bun run astro build
	cd dist; zip -r wetterkarte.zip .
	cp ./dist/wetterkarte.zip .