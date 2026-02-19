#!/bin/bash
# Send random test emails via SMTP to generate email flow data
# Usage: bash scripts/send-random-test-emails.sh [count] [delay_seconds]
#   count: number of emails to send (default: 50)
#   delay: seconds between each email (default: 2)

SMTP_HOST="mail.tino.vn"
SMTP_PORT="587"
SMTP_USER="admin@Inix.vn"
SMTP_PASS='Tino@123!@#'
FROM_ADDRESS="admin@Inix.vn"

COUNT="${1:-50}"
DELAY="${2:-2}"

# Random recipient domains
DOMAINS=(
  "gmail.com"
  "yahoo.com"
  "outlook.com"
  "hotmail.com"
  "icloud.com"
  "protonmail.com"
  "mail.com"
  "zoho.com"
  "aol.com"
  "yandex.com"
)

# Random subject prefixes
SUBJECTS=(
  "Test delivery"
  "Performance check"
  "Monitoring test"
  "Email flow test"
  "Queue test"
  "Throughput test"
  "System check"
  "Delivery test"
  "SMTP test"
  "Mail test"
)

echo "=== TinoMail Random Email Sender ==="
echo "SMTP: ${SMTP_HOST}:${SMTP_PORT}"
echo "From: ${FROM_ADDRESS}"
echo "Count: ${COUNT}, Delay: ${DELAY}s"
echo "===================================="

sent=0
failed=0

for i in $(seq 1 "$COUNT"); do
  # Random recipient
  domain="${DOMAINS[$((RANDOM % ${#DOMAINS[@]}))]}"
  user="testuser$((RANDOM % 1000))"
  to="${user}@${domain}"

  # Random subject
  subject="${SUBJECTS[$((RANDOM % ${#SUBJECTS[@]}))]} #${i} - $(date +%H:%M:%S)"

  # Send via curl SMTP
  curl -s --max-time 30 \
    --url "smtp://${SMTP_HOST}:${SMTP_PORT}" \
    --ssl-reqd \
    --mail-from "${FROM_ADDRESS}" \
    --mail-rcpt "${to}" \
    --user "${SMTP_USER}:${SMTP_PASS}" \
    -T - <<EOF
From: ${FROM_ADDRESS}
To: ${to}
Subject: ${subject}
Date: $(date -R)
Message-ID: <test-$(date +%s)-${i}-${RANDOM}@Inix.vn>
Content-Type: text/plain; charset=utf-8

This is a test email #${i} sent at $(date) for monitoring dashboard testing.
Random ID: ${RANDOM}-${RANDOM}
EOF

  if [ $? -eq 0 ]; then
    sent=$((sent + 1))
    echo "[${i}/${COUNT}] OK -> ${to} | ${subject}"
  else
    failed=$((failed + 1))
    echo "[${i}/${COUNT}] FAIL -> ${to}"
  fi

  if [ "$i" -lt "$COUNT" ]; then
    sleep "$DELAY"
  fi
done

echo ""
echo "=== Done ==="
echo "Sent: ${sent} | Failed: ${failed} | Total: ${COUNT}"
