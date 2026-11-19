
$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:3000"

# Admin login
$login = Invoke-RestMethod `
  -Uri "$baseUrl/api/demo/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body (@{ role = "admin" } | ConvertTo-Json)

$headers = @{
  Authorization = "Bearer $($login.session.access_token)"
}

Write-Host "`n=== PROHORI KNOWLEDGE BASE SEED ===" -ForegroundColor Cyan

# 20 synthetic policies
$policies = @(
  @{ title="Refund Eligibility Policy"; content="Customers can request a refund within 30 calendar days of purchase. Requests must include the original transaction ID and proof of payment. Approved refunds are processed within 5 to 7 business days. Suspected fraudulent requests must be escalated to the risk team." },
  @{ title="Order Cancellation Policy"; content="Customers may cancel an order before it enters processing. Once processing begins, cancellation requires operator review. Approved cancellations must be recorded with a reason and order reference." },
  @{ title="Chargeback Handling Policy"; content="All chargeback notifications must be reviewed within one business day. Operators must collect transaction evidence and escalate disputed or suspicious cases to the risk team. Every action must be recorded in the audit log." },
  @{ title="Payment Failure Policy"; content="When a payment fails, customers should receive a failure notification and a transaction reference. Operators must verify the payment status before requesting another payment attempt. Duplicate payment attempts must be investigated." },
  @{ title="Payout Processing Policy"; content="Standard payouts are processed within 2 to 3 business days after approval. Payout requests must pass account verification and risk checks. Delayed or rejected payouts must include a recorded reason." },
  @{ title="Account Lock Policy"; content="Accounts may be temporarily locked after repeated failed login attempts or suspicious activity. Identity verification is required before an operator can request account recovery. Suspected account compromise must be escalated." },
  @{ title="KYC Verification Policy"; content="Customers must submit valid identity information for verification. Incomplete or unclear documents must be marked as requiring resubmission. Operators must not approve verification without reviewing the required evidence." },
  @{ title="Fraud Escalation Policy"; content="Suspected fraud must be escalated immediately to the risk team. Operators must preserve relevant transaction records and avoid promising refunds before investigation. All escalation decisions must be documented." },
  @{ title="Customer Data Privacy Policy"; content="Customer personal information must only be accessed for legitimate support or operational purposes. Staff must never disclose customer data to unauthorized persons. Suspected privacy incidents must be reported immediately." },
  @{ title="Data Retention Policy"; content="Customer support and transaction records must be retained according to the organization's approved retention schedule. Data must not be kept longer than required. Deletion requests must be reviewed by an authorized operator." },
  @{ title="Transaction Limit Policy"; content="Transactions must remain within the configured account and tenant limits. Requests exceeding a limit must be blocked or escalated for authorized review. Operators must never bypass transaction limits manually." },
  @{ title="Dispute Resolution Policy"; content="Customer disputes must receive an initial response within one business day. Operators must review transaction evidence and communicate the investigation status. Unresolved disputes must be escalated to the supervisor." },
  @{ title="Support SLA Policy"; content="High-priority support requests must receive an initial response within one hour during service hours. Normal requests must receive an initial response within one business day. Missed service targets must be recorded." },
  @{ title="Failed Transfer Policy"; content="A failed transfer must be checked against the transaction status before retrying. If funds were debited but not received, the case must be escalated for reconciliation. Customers must receive a clear status update." },
  @{ title="Duplicate Charge Policy"; content="Customers reporting duplicate charges must provide transaction references when available. Operators must verify both charges before initiating a correction or refund. Confirmed duplicate charges must be documented." },
  @{ title="Fee Waiver Policy"; content="Fee waiver requests require an authorized operator's review. The reason and applicable transaction must be recorded. Repeated or unusual waiver requests must be escalated to the supervisor." },
  @{ title="Lost Card Policy"; content="A customer reporting a lost payment card must be guided to block or freeze the card through the approved channel. Identity verification is required before account-related changes. Suspicious transactions must be escalated." },
  @{ title="Unauthorized Payment Policy"; content="Reports of unauthorized payments must be treated as high priority. Operators must verify the customer's identity, secure the account where appropriate, and escalate the transaction to the risk team." },
  @{ title="Identity Verification Policy"; content="Identity verification must use the approved verification process. Operators must check submitted information for consistency and validity. Failed verification must include a reason and instructions for the next step." },
  @{ title="Complaint Escalation Policy"; content="Unresolved complaints must be escalated to a supervisor after the initial support review. The escalation must include the complaint history, relevant transaction references, and actions already taken." }
)

$ingestSuccess = 0
$ingestFailed = 0

Write-Host "`n--- Ingesting 20 policies ---" -ForegroundColor Yellow

foreach ($policy in $policies) {
  try {
    $body = @{
      title = $policy.title
      source = "synthetic-policy"
      content = $policy.content
    } | ConvertTo-Json -Depth 10

    $response = Invoke-RestMethod `
      -Uri "$baseUrl/api/knowledge/documents" `
      -Method Post `
      -Headers $headers `
      -ContentType "application/json" `
      -Body $body

    $ingestSuccess++
    Write-Host "[OK] $($policy.title)"
  }
  catch {
    $ingestFailed++
    Write-Host "[FAILED] $($policy.title): $($_.Exception.Message)" -ForegroundColor Red
  }
}

# 20 retrieval evaluation questions
$tests = @(
  @{ query="What is the deadline for requesting a refund after purchase?"; expected="Refund Eligibility Policy" },
  @{ query="Can an order be cancelled after processing starts?"; expected="Order Cancellation Policy" },
  @{ query="How quickly should a chargeback notification be reviewed?"; expected="Chargeback Handling Policy" },
  @{ query="What should support do when a customer payment fails?"; expected="Payment Failure Policy" },
  @{ query="How long does an approved payout normally take?"; expected="Payout Processing Policy" },
  @{ query="Why might a customer account become locked?"; expected="Account Lock Policy" },
  @{ query="What documents are needed for customer KYC?"; expected="KYC Verification Policy" },
  @{ query="Who handles suspicious fraudulent transactions?"; expected="Fraud Escalation Policy" },
  @{ query="Can staff share customer personal information?"; expected="Customer Data Privacy Policy" },
  @{ query="How long should customer records be retained?"; expected="Data Retention Policy" },
  @{ query="What happens when a transaction exceeds account limits?"; expected="Transaction Limit Policy" },
  @{ query="How soon must a customer dispute receive a response?"; expected="Dispute Resolution Policy" },
  @{ query="What is the response time for high priority support tickets?"; expected="Support SLA Policy" },
  @{ query="What happens if money is debited but a transfer fails?"; expected="Failed Transfer Policy" },
  @{ query="How are duplicate payment charges investigated?"; expected="Duplicate Charge Policy" },
  @{ query="Who can approve a customer fee waiver?"; expected="Fee Waiver Policy" },
  @{ query="What should a customer do after losing a payment card?"; expected="Lost Card Policy" },
  @{ query="How should an unauthorized payment report be handled?"; expected="Unauthorized Payment Policy" },
  @{ query="What happens when identity verification fails?"; expected="Identity Verification Policy" },
  @{ query="When should an unresolved customer complaint be escalated?"; expected="Complaint Escalation Policy" }
)

$hits = 0
$testFailed = 0

Write-Host "`n--- Running 20 retrieval tests ---" -ForegroundColor Yellow

foreach ($test in $tests) {
  try {
    $body = @{
      query = $test.query
      limit = 5
    } | ConvertTo-Json

    $result = Invoke-RestMethod `
      -Uri "$baseUrl/api/knowledge/search" `
      -Method Post `
      -Headers $headers `
      -ContentType "application/json" `
      -Body $body

    $matched = @(
      $result.results | Where-Object {
        $_.title -eq $test.expected
      }
    ).Count -gt 0

    if ($matched) {
      $hits++
      Write-Host "[HIT] $($test.expected)" -ForegroundColor Green
    }
    else {
      Write-Host "[MISS] $($test.expected)" -ForegroundColor Red
    }
  }
  catch {
    $testFailed++
    Write-Host "[ERROR] $($test.expected): $($_.Exception.Message)" -ForegroundColor Red
  }
}

$total = $tests.Count
$accuracy = [math]::Round(($hits / $total) * 100, 2)

Write-Host "`n========== FINAL REPORT ==========" -ForegroundColor Cyan
Write-Host "Policies ingested: $ingestSuccess / $($policies.Count)"
Write-Host "Ingestion failures: $ingestFailed"
Write-Host "Retrieval hits: $hits / $total"
Write-Host "Retrieval errors: $testFailed"
Write-Host "Hit@5 accuracy: $accuracy%"
Write-Host "=================================" -ForegroundColor Cyan
