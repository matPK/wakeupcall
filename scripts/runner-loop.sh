#!/bin/sh
set -eu

interval="${RUNNER_INTERVAL_SECONDS:-60}"

case "$interval" in
  ''|*[!0-9]*)
    echo "RUNNER_INTERVAL_SECONDS must be a positive integer. Got: $interval" >&2
    exit 1
    ;;
esac

if [ "$interval" -lt 10 ]; then
  echo "RUNNER_INTERVAL_SECONDS too low ($interval). Using 10 seconds." >&2
  interval=10
fi

echo "Runner loop started. Interval=${interval}s"

while true; do
  if npm run runner; then
    echo "Runner completed successfully."
  else
    echo "Runner execution failed. Retrying in ${interval}s." >&2
  fi
  sleep "$interval"
done
