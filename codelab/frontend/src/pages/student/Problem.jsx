import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { Play, Send, ArrowLeft, CheckCircle, XCircle, Clock, Loader, AlertCircle } from 'lucide-react';

const MONACO_LANG = { python: 'python', javascript: 'javascript', java: 'java', cpp: 'cpp', c: 'c' };

const STARTERS = {
  python: `# Python Solution\nimport sys\ninput = sys.stdin.readline\n\ndef solve():\n    # Read input\n    n = int(input())\n    \n    # Your solution here\n    print(n)\n\nsolve()\n`,
  javascript: `// JavaScript Solution\nconst readline = require('readline');\nconst rl = readline.createInterface({ input: process.stdin });\nconst lines = [];\nrl.on('line', l => lines.push(l.trim()));\nrl.on('close', () => {\n    const n = parseInt(lines[0]);\n    // Your solution here\n    console.log(n);\n});\n`,
  java: `import java.util.*;\nimport java.io.*;\n\npublic class Solution {\n    public static void main(String[] args) throws IOException {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        int n = Integer.parseInt(br.readLine().trim());\n        \n        // Your solution here\n        System.out.println(n);\n    }\n}\n`,
  cpp: `#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    ios_base::sync_with_stdio(false);\n    cin.tie(NULL);\n    \n    int n;\n    cin >> n;\n    \n    // Your solution here\n    cout << n << endl;\n    \n    return 0;\n}\n`,
  c: `#include <stdio.h>\n\nint main() {\n    int n;\n    scanf("%d", &n);\n    \n    // Your solution here\n    printf("%d\\n", n);\n    \n    return 0;\n}\n`,
};

const DiffBadge = ({ d }) => {
  const c = { easy: 'text-emerald-400 bg-emerald-500/10', medium: 'text-yellow-400 bg-yellow-500/10', hard: 'text-red-400 bg-red-500/10' };
  return <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-mono ${c[d]}`}>{d}</span>;
};

// Returns a human-readable status message based on elapsed seconds + language
function getRunStatusMsg(elapsed, language) {
  if (elapsed < 2)  return 'Sending to server…';
  if (elapsed < 6)  return language === 'java' || language === 'cpp' || language === 'c'
                            ? `Compiling ${language.toUpperCase()}…`
                            : 'Starting execution…';
  if (elapsed < 15) return 'Executing your code…';
  if (elapsed < 25) return 'Still running… (server is busy)';
  if (elapsed < 35) return 'Almost done, hang tight…';
  return 'Finishing up…';
}

export default function StudentProblem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [problem, setProblem]               = useState(null);
  const [language, setLanguage]             = useState('python');
  const [code, setCode]                     = useState(STARTERS.python);
  const [stdin, setStdin]                   = useState('');
  const [output, setOutput]                 = useState(null);
  const [submitting, setSubmitting]         = useState(false);
  const [running, setRunning]               = useState(false);
  const [runElapsed, setRunElapsed]         = useState(0);   // seconds since run started
  const [runStatusMsg, setRunStatusMsg]     = useState('');  // text shown in output panel
  const [submissionId, setSubmissionId]     = useState(null);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [polling, setPolling]               = useState(false);
  const [activeTab, setActiveTab]           = useState('description');
  const timerRef                            = useRef(null);

  useEffect(() => {
    api.get(`/api/problems/${id}`).then(res => {
      const p = res.data.problem;
      setProblem(p);
      const allowed = p.allowed_languages[0] || 'python';
      setLanguage(allowed);
      setCode(STARTERS[allowed] || '// Write your solution here\n');
      if (p.testCases?.[0]) setStdin(p.testCases[0].input);
    });
  }, [id]);

  const changeLanguage = (lang) => {
    if (window.confirm('Changing language will reset your code. Continue?')) {
      setLanguage(lang);
      setCode(STARTERS[lang] || `// ${lang} solution\n`);
    }
  };

  const runCode = async () => {
    setRunning(true);
    setOutput(null);
    setRunElapsed(0);
    setRunStatusMsg(getRunStatusMsg(0, language));

    // Start live elapsed timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      const sec = Math.floor((Date.now() - startTime) / 1000);
      setRunElapsed(sec);
      setRunStatusMsg(getRunStatusMsg(sec, language));
    }, 500);

    try {
      const res = await api.post('/api/submissions/run', { code, language, stdin });
      setOutput(res.data);
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.error;
      if (status === 429) {
        toast.error(msg || 'Please wait a few seconds before running again.', { icon: '⏸' });
        setOutput({ _rateLimited: true, message: msg || 'Rate limited — please wait a moment.' });
      } else {
        toast.error(msg || 'Run failed. Please try again.');
        setOutput({ _error: true, message: msg || 'Execution failed.' });
      }
    } finally {
      clearInterval(timerRef.current);
      timerRef.current = null;
      setRunning(false);
      // keep elapsed visible briefly so student knows how long it took
      setTimeout(() => { setRunElapsed(0); setRunStatusMsg(''); }, 4000);
    }
  };

  const submitCode = async () => {
    setSubmitting(true);
    setSubmissionResult(null);
    try {
      const res = await api.post('/api/submissions', { problemId: id, language, code });
      const sid = res.data.submission.id;
      setSubmissionId(sid);
      setActiveTab('results');
      toast.success('Submitted! Running test cases…');
      pollResult(sid);
    } catch (err) {
      toast.error('Submission failed');
      setSubmitting(false);
    }
  };

  const pollResult = useCallback(async (sid) => {
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.get(`/api/submissions/${sid}`);
        const sub = res.data.submission;
        if (sub.status !== 'running' && sub.status !== 'pending') {
          setSubmissionResult(sub);
          setPolling(false);
          setSubmitting(false);
          clearInterval(interval);
          if (sub.status === 'accepted') toast.success('All test cases passed! 🎉');
          else toast.error(`Result: ${sub.status.replace(/_/g, ' ')}`);
        }
      } catch {}
      if (attempts >= 30) {
        clearInterval(interval);
        setPolling(false);
        setSubmitting(false);
      }
    }, 1500);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), []);

  if (!problem) return (
    <div className="flex justify-center items-center h-full p-8">
      <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  // ── RUN BUTTON label & style ──
  const runBtnContent = running ? (
    <>
      <Loader size={14} className="animate-spin flex-shrink-0" />
      <span className="font-mono tabular-nums">{runElapsed}s</span>
    </>
  ) : (
    <><Play size={14} /> Run</>
  );

  // ── STDOUT PANEL content ──
  const renderOutput = () => {
    if (running) {
      const pct = Math.min((runElapsed / 45) * 100, 97);
      return (
        <div className="flex flex-col gap-3 p-1">
          {/* Status row */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-blue-950/40 border border-blue-800/40">
            <Loader size={13} className="animate-spin text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-blue-300">{runStatusMsg}</div>
              <div className="text-xs text-slate-500 mt-0.5">Your code is running on the server</div>
            </div>
            <span className="font-mono text-lg font-bold text-blue-400 tabular-nums flex-shrink-0">
              {runElapsed}s
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-1000"
              style={{ width: `${pct}%` }}
            />
          </div>
          {/* Compile hint for compiled languages */}
          {(language === 'java' || language === 'cpp' || language === 'c') && runElapsed < 8 && (
            <div className="text-xs text-slate-600 font-mono px-1">
              $ {language === 'java' ? 'javac Solution.java && java Solution' : `g++ solution.cpp -o solution && ./solution`}
            </div>
          )}
        </div>
      );
    }

    if (!output) return (
      <p className="text-xs text-gray-700 font-mono">Run your code to see output here</p>
    );

    if (output._rateLimited) return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-yellow-950/30 border border-yellow-800/40">
        <Clock size={14} className="text-yellow-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-xs font-semibold text-yellow-300">Rate limited</div>
          <div className="text-xs text-yellow-600 mt-0.5">{output.message}</div>
        </div>
      </div>
    );

    if (output._error) return (
      <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-red-950/30 border border-red-800/40">
        <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
        <div>
          <div className="text-xs font-semibold text-red-300">Execution failed</div>
          <div className="text-xs text-red-500 mt-0.5">{output.message}</div>
        </div>
      </div>
    );

    return (
      <div>
        {output.stdout && (
          <pre className="font-mono text-xs text-gray-300 whitespace-pre-wrap">{output.stdout}</pre>
        )}
        {output.stderr && (
          <pre className="font-mono text-xs text-red-400 whitespace-pre-wrap mt-2">{output.stderr}</pre>
        )}
        <div className="text-xs text-gray-600 mt-2 flex items-center gap-2">
          <CheckCircle size={11} className="text-emerald-600" />
          Exit: {output.exitCode} · {output.executionTimeMs}ms
          {runElapsed > 0 && <span className="text-slate-700">· waited {runElapsed}s</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <button onClick={() => navigate('/student')} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h1 className="font-semibold text-white truncate">{problem.title}</h1>
          <DiffBadge d={problem.difficulty} />
        </div>
        <select value={language} onChange={e => changeLanguage(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500 font-mono">
          {problem.allowed_languages?.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        {/* RUN BUTTON — shows live timer when running */}
        <button
          onClick={runCode}
          disabled={running}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all min-w-[80px] justify-center
            ${running
              ? 'bg-blue-950 text-blue-300 border border-blue-800/60 cursor-not-allowed'
              : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
        >
          {runBtnContent}
        </button>

        <button onClick={submitCode} disabled={submitting}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
          {submitting ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>

      {/* Main content: 2 panes */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Problem description */}
        <div className="w-2/5 flex flex-col border-r border-gray-800 overflow-hidden">
          <div className="flex border-b border-gray-800 flex-shrink-0">
            {['description', 'results'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-2.5 text-sm capitalize transition-colors ${activeTab === tab ? 'text-sky-400 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-300'}`}>
                {tab}
                {tab === 'results' && polling && (
                  <span className="ml-1.5 inline-block w-1.5 h-1.5 bg-sky-400 rounded-full animate-pulse" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {activeTab === 'description' ? (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-gray-500">Time: {problem.time_limit_ms}ms</span>
                  <span className="text-gray-700">·</span>
                  <span className="text-xs text-gray-500">Memory: {problem.memory_limit_mb}MB</span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-gray-300 font-sans leading-relaxed">{problem.description}</pre>
                </div>
                {problem.testCases?.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Sample Test Cases</h3>
                    <div className="space-y-3">
                      {problem.testCases.map((tc, i) => (
                        <div key={i} className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-4">
                          <div className="text-xs text-gray-500 mb-2">Example {i + 1}</div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Input</div>
                              <pre className="font-mono text-xs text-gray-300 bg-gray-900 rounded-lg px-3 py-2">{tc.input || '(empty)'}</pre>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Output</div>
                              <pre className="font-mono text-xs text-gray-300 bg-gray-900 rounded-lg px-3 py-2">{tc.expected_output}</pre>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {!submissionResult && !polling ? (
                  <div className="text-center py-12 text-gray-600">
                    <Send size={32} className="mx-auto mb-3 opacity-50" />
                    <p>Submit your code to see results</p>
                  </div>
                ) : polling ? (
                  <div className="text-center py-12">
                    <Loader size={32} className="mx-auto mb-3 text-sky-400 animate-spin" />
                    <p className="text-gray-400">Running test cases…</p>
                  </div>
                ) : (
                  <div>
                    <div className={`rounded-xl p-4 mb-5 ${
                      submissionResult.status === 'accepted'         ? 'bg-emerald-500/10 border border-emerald-500/30' :
                      submissionResult.status === 'compilation_error'? 'bg-orange-500/10 border border-orange-500/30' :
                      submissionResult.status === 'time_limit_exceeded' ? 'bg-yellow-500/10 border border-yellow-500/30' :
                      'bg-red-500/10 border border-red-500/30'}`}>
                      <div className="flex items-center gap-3">
                        {submissionResult.status === 'accepted'
                          ? <CheckCircle size={24} className="text-emerald-400" />
                          : submissionResult.status === 'compilation_error'
                          ? <AlertCircle size={24} className="text-orange-400" />
                          : <XCircle size={24} className="text-red-400" />}
                        <div>
                          <div className={`font-semibold capitalize ${
                            submissionResult.status === 'accepted'          ? 'text-emerald-400' :
                            submissionResult.status === 'compilation_error' ? 'text-orange-400' :
                            submissionResult.status === 'time_limit_exceeded' ? 'text-yellow-400' :
                            'text-red-400'}`}>
                            {submissionResult.status.replace(/_/g, ' ')}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {submissionResult.score}/{submissionResult.max_score} test cases passed
                            {submissionResult.execution_time_ms && ` · ${submissionResult.execution_time_ms}ms`}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {submissionResult.testCaseResults?.map((r, i) => (
                        <div key={i} className={`rounded-xl border p-3 ${r.status === 'passed' ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {r.status === 'passed' ? <CheckCircle size={13} className="text-emerald-400" /> : <XCircle size={13} className="text-red-400" />}
                              <span className="text-xs font-medium text-gray-300">
                                {r.is_hidden ? 'Hidden Test' : `Test Case #${i + 1}`}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 font-mono">{r.execution_time_ms}ms</span>
                          </div>
                          {!r.is_hidden && r.status !== 'passed' && (
                            <div className="text-xs font-mono space-y-1">
                              <div><span className="text-gray-500">Input: </span><pre className="inline whitespace-pre-wrap text-gray-300">{r.input?.substring(0, 200)}</pre></div>
                              <div><span className="text-gray-500">Expected: </span><pre className="inline whitespace-pre-wrap text-emerald-400">{r.expected_output?.substring(0, 200)}</pre></div>
                              <div><span className="text-gray-500">Got: </span><pre className="inline whitespace-pre-wrap text-red-400">{r.actual_output?.substring(0, 200)}</pre></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor + IO */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <Editor
              height="100%"
              language={MONACO_LANG[language] || 'plaintext'}
              value={code}
              onChange={v => setCode(v || '')}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 16, bottom: 16 },
                lineNumbers: 'on',
                glyphMargin: false,
                folding: true,
                lineDecorationsWidth: 10,
                renderLineHighlight: 'line',
                automaticLayout: true,
              }}
            />
          </div>

          {/* Bottom: stdin / stdout */}
          <div className="h-52 border-t border-gray-800 flex flex-shrink-0">
            {/* Stdin */}
            <div className="flex-1 flex flex-col border-r border-gray-800">
              <div className="flex items-center px-4 py-2 bg-gray-900 border-b border-gray-800">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">stdin</span>
              </div>
              <textarea value={stdin} onChange={e => setStdin(e.target.value)}
                className="flex-1 bg-gray-950 p-3 font-mono text-xs text-gray-300 resize-none focus:outline-none"
                placeholder="Input for Run..." />
            </div>

            {/* Stdout */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
                <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">stdout</span>
                {running && (
                  <span className="ml-auto text-xs font-mono tabular-nums text-blue-500 animate-pulse">
                    {runElapsed}s elapsed
                  </span>
                )}
              </div>
              <div className="flex-1 p-3 overflow-auto">
                {renderOutput()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
