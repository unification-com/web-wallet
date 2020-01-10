.DEFAULT_GOAL := docker-dev


docker-dev:
	docker-compose -f Docker/docker-compose.yml down --remove-orphans
	docker-compose -f Docker/docker-compose.yml up

docker-dev-down:
	docker-compose -f Docker/docker-compose.yml down --remove-orphans

builder:
	docker build -f Docker/builder/Dockerfile . -t builder

copy: builder
	@rm -f ./build/*
	docker create -ti --name builder_webwallet builder /bin/sh
	docker cp builder_webwallet:/web-wallet.tar.gz ./build/web-wallet.tar.gz
	docker cp builder_webwallet:/web-wallet.tar.gz.sha ./build/web-wallet.tar.gz.sha
	docker rm -f builder_webwallet
