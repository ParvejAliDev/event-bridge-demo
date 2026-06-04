up:
	docker compose up --build

down:
	docker compose down --remove-orphans

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

smoke:
	npm run smoke
