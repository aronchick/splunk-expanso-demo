# Expanso Bug Reports

## Bug 1: `processors` field not recognized inside `http_client` output

**Severity:** High

**Description:**
When placing a `processors` field inside an `http_client` output block, the validator reports "field processors not recognised".

**Expected behavior:**
`processors` should be allowed inside output blocks for pre-send transformations, OR documentation should clarify the correct syntax.

**Actual behavior:**
Validation error: `field processors not recognised`

**Minimum reproduction:**
```yaml
name: test-pipeline
type: pipeline

config:
  input:
    generate:
      interval: 1s
      mapping: |
        root.message = "hello"

  output:
    http_client:
      url: http://example.com/endpoint
      verb: POST
      processors:  # ERROR: field processors not recognised
        - bloblang: |
            root.event = this.message
```

**Workaround:**
Place `processors` as a sibling to `http_client` under `output`:
```yaml
  output:
    processors:
      - bloblang: |
          root.event = this.message
    http_client:
      url: http://example.com/endpoint
      verb: POST
```

---

## Bug 2: `processors` field not recognized inside switch case outputs

**Severity:** High

**Description:**
Same issue as Bug 1, but specifically within switch/case output blocks.

**Minimum reproduction:**
```yaml
name: test-pipeline
type: pipeline

config:
  input:
    generate:
      interval: 1s
      mapping: |
        root.type = "a"

  output:
    switch:
      cases:
        - check: this.type == "a"
          output:
            http_client:
              url: http://example.com/endpoint
              verb: POST
              processors:  # ERROR: field processors not recognised
                - bloblang: |
                    root.event = this
```

**Workaround:**
Place `processors` as a sibling to `http_client` within the case's `output`:
```yaml
        - check: this.type == "a"
          output:
            processors:
              - bloblang: |
                  root.event = this
            http_client:
              url: http://example.com/endpoint
              verb: POST
```

---

## Bug 3: Bloblang parser error with multi-line object literals inside conditionals

**Severity:** Medium

**Description:**
Using `root = if condition { ... }` with multi-line object literals inside the conditional branches causes a parser error.

**Error message:**
`required: expected }, got: <identifier>`

**Minimum reproduction:**
```yaml
name: test-pipeline
type: pipeline

config:
  input:
    generate:
      interval: 1s
      mapping: |
        let type_roll = random_int(max: 100)

        root = if $type_roll < 50 {
          # This multi-line object literal causes parser error
          let methods = ["GET", "POST"]
          {
            "method": $methods.index(random_int(max: 1)),
            "status": 200
          }
        } else {
          {
            "method": "DELETE",
            "status": 404
          }
        }
```

**Workaround:**
Declare all variables at the top level, then use inline conditionals for each field:
```yaml
      mapping: |
        let type_roll = random_int(max: 100)
        let methods = ["GET", "POST"]

        root.method = if $type_roll < 50 { $methods.index(random_int(max: 1)) } else { "DELETE" }
        root.status = if $type_roll < 50 { 200 } else { 404 }
```

---

## Bug 4: Bloblang parser fails with complex expressions inside `.format()` calls

**Severity:** Medium

**Description:**
Using `random_int(min: X, max: Y)` or other complex expressions directly inside `.format()` string interpolation can cause parser errors.

**Error message:**
`required: expected argument value, got:`

**Minimum reproduction:**
```yaml
name: test-pipeline
type: pipeline

config:
  input:
    generate:
      interval: 1s
      mapping: |
        root._raw = "%s %s".format(
          random_int(min: 100, max: 50000).string(),
          now().ts_strftime("%d/%b/%Y:%H:%M:%S -0800")
        )
```

**Workaround:**
Extract complex expressions into `let` variables first:
```yaml
      mapping: |
        let bytes = random_int(min: 100, max: 50000)
        let ts = now().ts_strftime("%d/%b/%Y:%H:%M:%S -0800")

        root._raw = "%s %s".format($bytes.string(), $ts)
```

---

## Bug 5: UI - Red text on black background is unreadable

**Severity:** Medium (Accessibility)

**Description:**
Error messages or highlighted text displayed in red on a black terminal background has very poor contrast and is difficult to read.

**Expected behavior:**
Error text should use a lighter red or different color scheme that provides sufficient contrast on dark backgrounds (WCAG AA minimum contrast ratio of 4.5:1).

**Actual behavior:**
Red text on black background is nearly unreadable.

**Environment:**
Dark terminal / dark mode

---

## Bug 6: UI - Syntax highlighting should use light purple in dark mode

**Severity:** Low (UI Polish)

**Description:**
In dark mode, certain syntax elements should be displayed in light purple for better readability and visual consistency with modern dark themes.

**Expected behavior:**
Keywords or specific syntax elements render in light purple (#B39DDB or similar) when dark mode is active.

**Actual behavior:**
Current color scheme does not adapt well to dark mode.

---

## Bug 7: Validation error messages don't account for YAML structure

**Severity:** Low (Developer Experience)

**Description:**
Error messages report line/column positions relative to the Bloblang content inside the `mapping: |` block, not the actual line numbers in the YAML file. This makes it difficult to locate errors.

**Example:**
Error reports `(10,21) required: expected }, got: metho` but line 10 of the YAML file is `type: pipeline`, not the actual error location.

**Expected behavior:**
Error messages should either:
1. Report absolute line numbers in the YAML file, OR
2. Clearly indicate they are relative to the Bloblang block start

---

## Bug 8: No validation warning for hardcoded values that defeat dynamic logic

**Severity:** Low (Developer Experience)

**Description:**
When a variable is hardcoded (e.g., `let region = "us"`) but later used in conditional logic that expects multiple values, no warning is issued that the conditional branches are unreachable.

**Minimum reproduction:**
```yaml
      mapping: |
        let region = "us"  # Hardcoded - EU/APAC branches will never execute

        let ips = if $region == "eu" { $eu_ips }
          else if $region == "apac" { $apac_ips }
          else { $us_ips }
```

**Expected behavior:**
Linter warning: "Conditional branches for 'eu' and 'apac' are unreachable because $region is always 'us'"

---

## Environment

- **Expanso Version:** [version]
- **OS:** Linux
- **Terminal:** [terminal emulator]
- **Color scheme:** Dark mode

---

## Bug 9: "ReRun" is the wrong language for a stopped pipeline
When a pipeline is stopped, the only option is "rerun" and it's in red. This is not correct. It could be "restart", or "start", but neither should be in red. 
