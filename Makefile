# Makefile for AWS Amplify deployment

.PHONY: install build deploy-prepare local-test amplify-build

# Install dependencies
install:
	npm ci

# Build the application
build:
	npm run build

# Prepare for deployment
deploy-prepare:
	npm run build:amplify

# Run local test of production build
local-test:
	cd dist && node index.js

# Build specifically for Amplify
amplify-build:
	npm ci
	npm run build:amplify

# Help command
help:
	@echo "Available commands:"
	@echo "  make install        - Install dependencies"
	@echo "  make build          - Build the application"
	@echo "  make deploy-prepare - Prepare for deployment (build + additional steps)"
	@echo "  make local-test     - Test the production build locally"
	@echo "  make amplify-build  - Build specifically for AWS Amplify deployment" 