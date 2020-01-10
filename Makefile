.DEFAULT_GOAL := docker-dev


docker-dev:
	docker-compose -f Docker/docker-compose.yml down --remove-orphans
	docker-compose -f Docker/docker-compose.yml up

docker-dev-down:
	docker-compose -f Docker/docker-compose.yml down --remove-orphans
