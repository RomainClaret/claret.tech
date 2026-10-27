# The image act runs ubuntu-latest jobs in (.actrc names it). GitHub's
# runners have jq, gh and docker, which CI's steps use: the deploy's gate
# script and its test (.github/scripts/browser-tests-passed*.sh), and
# actionlint, which `npm run lint:workflows` runs from its own image through
# the host's Docker socket (act mounts it). node:24-bookworm has none of
# them, so those steps failed under act on the image, not on the code.
#
#   docker build --platform linux/amd64 -t claret-act:24 .github/act
FROM docker:29-cli@sha256:5e6baf67325a79f64ed3bed6863954d5e05d0f3d4e57cbdb14809346814bbfdb AS docker-cli

FROM node:24-bookworm@sha256:6449e19d8184d84062525b6a7524def03146c2cb04a7f08b076680d0e8e4240a
RUN apt-get update \
  && apt-get install -y --no-install-recommends jq gh \
  && rm -rf /var/lib/apt/lists/*
COPY --from=docker-cli /usr/local/bin/docker /usr/local/bin/docker
