(function () {
  'use strict';

  function init() {
    var root = document.getElementById('release-radar-root');
    if (!root || root.dataset.rrInitialized) return;
    root.dataset.rrInitialized = 'true';

    var $ = function (id) { return root.querySelector('#' + id); };
    var isApex = !!(window.apex && window.apex.server && typeof window.apex.server.process === 'function');
    var state = { report: null, fixture: null, runs: [], findings: [], selected: null, filter: 'ALL', query: '', busy: false, ready: false, retry: 'bootstrap' };
    var severityOrder = { BREAKING: 0, TEST: 1, OPPORTUNITY: 2 };

    function esc(value) {
      return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }
    function text(id, value) { $(id).textContent = value == null ? '' : String(value); }
    function count(value) { return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—'; }
    function date(value) {
      if (!value) return 'Time unavailable';
      var parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
    function severity(finding) { return String(finding.severity || 'UNCLASSIFIED').toUpperCase(); }
    function badge(value) {
      var key = String(value || 'UNCLASSIFIED').toUpperCase();
      var cls = Object.prototype.hasOwnProperty.call(severityOrder, key) ? ' rr-badge-' + key.toLowerCase() : '';
      return '<span class="rr-badge' + cls + '">' + esc(key === 'TEST' ? 'NEEDS TESTING' : key) + '</span>';
    }
    function confidence(value) {
      if (value == null || value === '') return 'Confidence not provided';
      // The pipeline contract supplies confidence on a 0–100 scale.
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) return value + '% confidence · supplied by report';
      return String(value) + ' confidence · supplied by report';
    }
    function safeUrl(value) {
      try { var url = new URL(String(value)); return /^https?:$/.test(url.protocol) ? url.href : null; }
      catch (_) { return null; }
    }
    function isSyntheticSource(finding) {
      if (String(finding.source_kind || '').trim().toUpperCase() === 'SYNTHETIC') return true;
      try { return /(^|\.)invalid$/i.test(new URL(String(finding.source_url)).hostname.replace(/\.$/, '')); }
      catch (_) { return false; }
    }
    function setBusy(busy) {
      state.busy = busy;
      $('rr-run').disabled = busy || !state.ready;
      $('rr-customer').disabled = busy || !state.ready;
      $('rr-release').disabled = busy || !state.ready;
      $('rr-retry').disabled = busy;
      $('rr-findings').setAttribute('aria-busy', String(busy));
      text('rr-run-label', busy && state.ready ? 'Loading prepared report…' : 'Run prepared demo');
    }
    function showError(message, retry) {
      state.retry = retry;
      text('rr-error-message', message);
      $('rr-error').hidden = false;
      text('rr-status', state.report ? 'Request failed. The previous report is still displayed.' : 'Workspace needs attention. See the message above.');
    }
    function apexRequest(name, data) {
      return new Promise(function (resolve, reject) {
        window.apex.server.process(name, data || {}, {
          dataType: 'json',
          success: function (result) {
            if (result && result.error) reject(new Error('The APEX process returned an error. Check the process configuration and try again.'));
            else resolve(result);
          },
          error: function () { reject(new Error('The APEX request failed. Check your connection or sign in again, then retry.')); }
        });
      });
    }
    function validateReport(report) {
      if (!report || typeof report !== 'object' || !Array.isArray(report.findings) || !report.summary || typeof report.summary !== 'object' || report.findings.some(function (f) { return !f || typeof f !== 'object'; })) {
        throw new Error('The report format is incomplete. Expected summary and findings from the prepared demo.');
      }
      return report;
    }
    function options(select, values) {
      select.replaceChildren();
      values.forEach(function (item) { var option = document.createElement('option'); option.value = item.value; option.textContent = item.label; select.appendChild(option); });
    }
    async function bootstrap() {
      $('rr-error').hidden = true;
      setBusy(true);
      text('rr-status', 'Loading the prepared workspace…');
      text('rr-environment', isApex ? 'Oracle APEX · Prepared demo' : 'Web preview · Prepared demo');
      text('rr-mode-note', isApex ? ' Synthetic release data, prepared findings and test cases. No live AI or official Oracle release guidance.' : ' Synthetic release data and prepared findings. No live AI. Preview runs stay in this browser session only and reset on reload.');
      try {
        var data;
        if (isApex) data = await apexRequest('RR_BOOTSTRAP');
        else {
          var response = await fetch('./demo-data.json', { cache: 'no-store', credentials: 'same-origin' });
          if (!response.ok) throw new Error('Prepared demo data could not be loaded (HTTP ' + response.status + '). Check that demo-data.json is available beside this page.');
          try { data = await response.json(); }
          catch (_) { throw new Error('demo-data.json is not valid JSON. Restore the prepared bootstrap file and retry.'); }
        }
        if (!data || !Array.isArray(data.customers) || !data.customers.length || !Array.isArray(data.releases) || !data.releases.length) throw new Error('The workspace has no customers or releases. Check the bootstrap data and retry.');
        var customers = data.customers.filter(function (c) { return typeof c === 'string' && c.trim(); });
        var releases = data.releases.filter(function (r) { return r && typeof r.code === 'string' && r.code.trim(); });
        if (!customers.length || !releases.length) throw new Error('The customer or release list has an invalid format.');
        if (data.report != null) validateReport(data.report);
        options($('rr-customer'), customers.map(function (c) { return { value: c, label: c }; }));
        options($('rr-release'), releases.map(function (r) { return { value: r.code, label: r.label || r.code }; }));
        state.fixture = data.report || null;
        state.runs = Array.isArray(data.runs) ? data.runs.filter(function (r) { return r && typeof r === 'object'; }).map(function (r) { return Object.assign({}, r, { run_id: r.run_id || r.id }); }) : [];
        state.ready = true;
        if (data.report) {
          if (customers.indexOf(data.report.customer) !== -1) $('rr-customer').value = data.report.customer;
          if (releases.some(function (r) { return r.code === data.report.release_code; })) $('rr-release').value = data.report.release_code;
          setReport(data.report);
        }
        renderHistory();
        text('rr-status', data.report ? (isApex ? 'Prepared report loaded. Run the demo to save a new analysis run.' : 'Prepared dataset loaded. Run the demo to create a new preview run.') : 'Workspace ready. Select a customer and release, then run the prepared demo.');
      } catch (error) {
        var message = error.message;
        if (!isApex && (window.location.protocol === 'file:' || error instanceof TypeError)) message = 'Serve this folder over HTTP to load demo-data.json. Check that the prepared file is available, then retry.';
        showError(message, 'bootstrap');
      } finally { setBusy(false); }
    }
    async function run() {
      if (state.busy || !state.ready) return;
      var customer = $('rr-customer').value;
      var release = $('rr-release').value;
      $('rr-error').hidden = true;
      setBusy(true);
      text('rr-status', isApex ? 'Requesting the prepared demo report…' : 'Creating a preview run from the prepared dataset…');
      try {
        var report;
        if (isApex) report = await apexRequest('RR_RUN_ANALYSIS', { x01: customer, x02: release });
        else {
          if (!state.fixture) throw new Error('The preview dataset has no report. Add the prepared report to demo-data.json and reload the workspace.');
          if ((state.fixture.customer && state.fixture.customer !== customer) || (state.fixture.release_code && state.fixture.release_code !== release)) throw new Error('The preview dataset does not cover this customer and release. Select the prepared scope or use the APEX workspace.');
          report = JSON.parse(JSON.stringify(state.fixture));
          var now = new Date().toISOString();
          report.run_id = 'local-' + (window.crypto && typeof window.crypto.randomUUID === 'function' ? window.crypto.randomUUID() : Date.now().toString(36) + '-' + (state.runs.length + 1));
          report.started_at = now;
          report.completed_at = now;
          report.customer = customer;
          report.release_code = release;
          report.local_preview = true;
        }
        validateReport(report);
        setReport(report);
        state.runs = [report].concat(state.runs.filter(function (r) { return r.run_id !== report.run_id; }));
        renderHistory();
        text('rr-status', (isApex ? 'Prepared demo returned by APEX' : 'Web preview created from prepared dataset') + ' · Status: ' + (report.status || 'not provided') + ' · ' + date(report.completed_at || report.started_at) + '. Select a finding to review its evidence.');
      } catch (error) { showError(error.message, 'run'); }
      finally { setBusy(false); }
    }
    function setReport(report) {
      state.report = report;
      state.findings = report.findings.map(function (finding, index) { return { finding: finding, id: index }; }).sort(function (a, b) {
        var aRank = severityOrder[severity(a.finding)];
        var bRank = severityOrder[severity(b.finding)];
        return (aRank == null ? 3 : aRank) - (bRank == null ? 3 : bRank) || a.id - b.id;
      });
      state.selected = null;
      state.filter = 'ALL';
      state.query = '';
      $('rr-search').value = '';
      var summary = report.summary;
      var totals = summary.findings_by_severity || {};
      text('rr-kpi-objects', count(summary.objects_checked));
      text('rr-kpi-features', count(summary.release_features) + ' release features reviewed');
      text('rr-kpi-breaking', count(totals.BREAKING));
      text('rr-kpi-test', count(totals.TEST));
      text('rr-kpi-opportunity', count(totals.OPPORTUNITY));
      text('rr-kpi-clear', count(summary.objects_without_findings));
      text('rr-report-meta', (report.customer || 'Customer unavailable') + ' / ' + (report.release_code || 'Release unavailable') + ' · ' + (report.local_preview ? 'Web preview' : 'Prepared report') + ' · ' + date(report.completed_at || report.started_at));
      text('rr-finding-total', state.findings.length);
      root.querySelectorAll('[data-count]').forEach(function (el) { var key = el.dataset.count; el.textContent = key === 'ALL' ? state.findings.length : state.findings.filter(function (f) { return severity(f.finding) === key; }).length; });
      $('rr-download').disabled = false;
      $('rr-print').disabled = false;
      renderList();
    }
    function visibleFindings() {
      return state.findings.filter(function (entry) {
        var f = entry.finding;
        return (state.filter === 'ALL' || severity(f) === state.filter) && (!state.query || [f.object_key, f.object_name, f.object_type, f.module, f.feature_key, f.feature_title, f.feature_description, f.rationale].join(' ').toLowerCase().includes(state.query));
      });
    }
    function renderList() {
      var visible = visibleFindings();
      root.querySelectorAll('[data-severity]').forEach(function (el) { var active = el.dataset.severity === state.filter; el.setAttribute('aria-pressed', String(active)); el.classList.toggle('rr-filter-active', active); });
      text('rr-result-count', state.report ? visible.length + ' of ' + state.findings.length + ' findings · sorted by severity' : 'Waiting for report');
      if (!visible.some(function (entry) { return entry.id === state.selected; })) state.selected = visible.length ? visible[0].id : null;
      if (!visible.length) {
        var hasReport = !!state.report;
        var filtered = state.findings.length > 0;
        $('rr-finding-list').innerHTML = '<div class="rr-empty"><span class="rr-empty-symbol" aria-hidden="true">' + (filtered ? '⌕' : '◎') + '</span><h3>' + (filtered ? 'No matching findings' : hasReport ? 'No findings in this report' : 'Your review starts here') + '</h3><p>' + (filtered ? 'Try another keyword or severity to broaden your review.' : hasReport ? 'No configuration matches were flagged. This is not a guarantee that the release is risk-free.' : 'Run the prepared demo to review release impact.') + '</p>' + (filtered ? '<button type="button" class="rr-button rr-button-secondary" data-clear-filters>Clear filters</button>' : '') + '</div>';
      } else {
        $('rr-finding-list').innerHTML = visible.map(function (entry) {
          var f = entry.finding;
          var rank = state.findings.indexOf(entry) + 1;
          return '<button type="button" class="rr-finding" data-finding="' + entry.id + '" aria-controls="rr-detail" aria-pressed="' + (entry.id === state.selected) + '"><span class="rr-finding-top"><span class="rr-rank">' + String(rank).padStart(2, '0') + '</span>' + badge(severity(f)) + '<span class="rr-finding-module">' + esc(f.module || f.object_type || 'Configuration') + '</span></span><span class="rr-finding-name">' + esc(f.object_name || f.object_key || 'Unnamed object') + '<span class="rr-finding-arrow" aria-hidden="true">↗</span></span><span class="rr-finding-feature">' + esc(f.feature_title || f.feature_key || 'Release feature') + '</span></button>';
        }).join('');
      }
      renderDetail();
    }
    function renderDetail() {
      var entry = state.findings.find(function (item) { return item.id === state.selected; });
      if (!entry) {
        $('rr-detail').innerHTML = '<div class="rr-empty rr-detail-empty"><span class="rr-empty-symbol" aria-hidden="true">↗</span><p class="rr-eyebrow">FROM CHANGE TO ACTION</p><h3 id="rr-detail-title">' + (state.report ? 'No finding selected' : 'Every finding tells the whole story.') + '</h3><p>Select a finding to compare your configuration with release evidence and review a regression test.</p><div class="rr-empty-steps"><span>01 &nbsp; Configuration</span><span>02 &nbsp; Evidence</span><span>03 &nbsp; Test plan</span></div></div>';
        return;
      }
      var f = entry.finding;
      var test = f.test_case && typeof f.test_case === 'object' ? f.test_case : {};
      var steps = Array.isArray(test.steps) ? test.steps : [];
      var synthetic = isSyntheticSource(f);
      var url = synthetic ? null : safeUrl(f.source_url);
      var source = synthetic ? '<p class="rr-source-note">Synthetic source · demo data</p>' : url ? '<a class="rr-source" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">View release source <span aria-hidden="true">↗</span><span class="rr-sr-only"> (opens in a new tab)</span></a>' : '<p class="rr-source-note">No valid source link provided.</p>';
      $('rr-detail').innerHTML = '<div class="rr-detail-header"><div class="rr-detail-kicker">' + badge(severity(f)) + '<span>' + esc(confidence(f.confidence)) + '</span></div><h3 id="rr-detail-title" tabindex="-1">' + esc(f.object_name || f.object_key || 'Unnamed object') + '</h3><div class="rr-detail-meta"><span>' + esc(f.object_type || 'Configuration object') + '</span><span>' + esc(f.module || 'Module not provided') + '</span><span>' + esc(f.object_key || 'Key not provided') + '</span></div></div>' +
        '<div class="rr-detail-body"><div class="rr-rationale"><h4>Why this matters</h4><p>' + esc(f.rationale || 'No rationale was supplied with this finding.') + '</p></div>' +
        '<div class="rr-comparison"><article class="rr-evidence-card"><div class="rr-evidence-label"><span aria-hidden="true">⌘</span> YOUR CONFIGURATION</div><div class="rr-evidence-content"><h4>' + esc(f.object_name || f.object_key || 'Configuration') + '</h4><p>' + esc(f.object_description || 'No object description supplied.') + '</p><pre class="rr-code"><code>' + esc(f.snippet || 'No configuration snippet supplied.') + '</code></pre></div></article>' +
        '<article class="rr-evidence-card"><div class="rr-evidence-label"><span aria-hidden="true">≡</span> RELEASE EVIDENCE</div><div class="rr-evidence-content"><h4>' + esc(f.feature_title || f.feature_key || 'Release feature') + '</h4><p>' + esc(f.feature_description || 'No feature description supplied.') + '</p><blockquote class="rr-quote">' + esc(f.cited_text || 'No cited excerpt supplied.') + '</blockquote>' + source + '<p class="rr-source-note">Source: ' + esc(f.source_kind || 'Not specified') + '</p></div></article></div>' +
        '<section aria-label="Regression test"><div class="rr-test-heading"><h4>Regression test plan</h4><span>PREPARED STEPS</span></div><p class="rr-test-title">' + esc(test.title || 'Test case not supplied') + '</p>' + (steps.length ? '<ol class="rr-test-steps">' + steps.map(function (step) { return '<li><span>' + esc(step) + '</span></li>'; }).join('') + '</ol>' : '<p class="rr-test-title">No test steps were included in this report.</p>') + '<div class="rr-expected"><strong>EXPECTED RESULT</strong>' + esc(test.expected || 'No expected result supplied.') + '</div></section><p class="rr-detail-footnote">Prepared demo evidence. Validate the finding and adapt the test to your environment before taking action.</p></div>';
    }
    function renderHistory() {
      text('rr-history-count', state.runs.length);
      text('rr-history-hint', isApex ? 'Server run history' : 'Browser session only');
      text('rr-history-note', isApex ? 'Runs supplied by APEX, plus runs completed in this session. Server persistence is managed by APEX.' : 'Prepared history and web preview runs. New preview runs stay in memory for this browser session only and disappear when you reload.');
      if (!state.runs.length) { $('rr-history-list').innerHTML = '<p>No runs yet. Run the prepared demo to add one.</p>'; return; }
      $('rr-history-list').innerHTML = '<table class="rr-history-table"><caption class="rr-sr-only">Analysis run history</caption><thead><tr><th scope="col">Run</th><th scope="col">Customer / release</th><th scope="col">Completed</th><th scope="col">Status</th><th scope="col">Mode</th></tr></thead><tbody>' + state.runs.map(function (r) { return '<tr><td>' + esc(r.run_id || 'Run ID unavailable') + '</td><td>' + esc(r.customer || '—') + ' / ' + esc(r.release_code || '—') + '</td><td>' + esc(date(r.completed_at || r.started_at)) + '</td><td>' + esc(r.status || '—') + '</td><td>' + esc(r.local_preview ? 'WEB PREVIEW / FIXTURE' : r.mode || 'FIXTURE') + '</td></tr>'; }).join('') + '</tbody></table>';
    }
    $('rr-run').addEventListener('click', run);
    $('rr-retry').addEventListener('click', function () { if (state.retry === 'bootstrap') bootstrap(); else run(); });
    ['rr-customer', 'rr-release'].forEach(function (id) { $(id).addEventListener('change', function () { text('rr-status', 'Scope changed. Run the prepared demo to load this selection. The displayed report retains its original scope.'); }); });
    $('rr-search').addEventListener('input', function (event) { state.query = event.target.value.trim().toLowerCase(); renderList(); });
    root.addEventListener('click', function (event) {
      var filter = event.target.closest('[data-severity]');
      if (filter && root.contains(filter)) { state.filter = filter.dataset.severity; renderList(); }
      var clear = event.target.closest('[data-clear-filters]');
      if (clear && root.contains(clear)) { state.filter = 'ALL'; state.query = ''; $('rr-search').value = ''; renderList(); $('rr-search').focus(); }
      var finding = event.target.closest('[data-finding]');
      if (finding && root.contains(finding)) {
        state.selected = Number(finding.dataset.finding);
        root.querySelectorAll('[data-finding]').forEach(function (button) { button.setAttribute('aria-pressed', String(Number(button.dataset.finding) === state.selected)); });
        renderDetail();
        $('rr-detail-title').focus({ preventScroll: true });
        if (window.matchMedia('(max-width:800px)').matches) $('rr-detail').scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    });
    $('rr-download').addEventListener('click', function () {
      if (!state.report) return;
      var blob = new Blob([JSON.stringify(state.report, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = 'release-radar-' + String(state.report.run_id || 'report').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0,100) + '.json';
      root.appendChild(link);
      link.click();
      link.remove();
      // Revoke after the browser has accepted the download, without delaying UI.
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      text('rr-status', 'JSON download requested. The export contains the complete report, including findings hidden by filters.');
    });
    $('rr-print').addEventListener('click', function () { text('rr-status', 'Print summary includes the current filters and selected finding. Download JSON for the complete report.'); window.print(); });
    bootstrap();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
}());
