var e=`omx-clap-core`,t=`587201ce6003e3b311f820beab3e2619ff4bef0a`,n=[{slug:``,src:`README.md`,title:`README.md`,source:`https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/README.md`,toc:[{id:`install`,title:`Install`},{id:`start`,title:`Start`},{id:`documentation`,title:`Documentation`},{id:`licence`,title:`Licence`}],html:`<h1 id="omx-clap-host">omx-clap-host</h1>
<p>omx-clap-host hosts CLAP and LV2 audio plugins without a screen. You drive it over a socket
with the same text commands as mod-host, and each plugin appears in your JACK or PipeWire
graph as a client of its own. It is for controllers, mixers and stage rigs on Linux that
already talk to mod-host and want CLAP plugins beside their LV2 ones.</p>
<p>An LV2 plugin runs natively, through lilv in the host's own process, mapped by the LV2 adapter
(<code>libomx-clap-lv2</code>). The CLAP hosting core is a library of its own, <code>libomx-clap-core</code>, for
programs that host CLAP plugins themselves. The host, the core and the adapter share one version.</p>
<h2 id="install">Install</h2>
<p>Fedora 44 (x86_64 and aarch64):</p>
<pre><code>sudo dnf install https://www.openmixer.org/rpm/openmixer-release.noarch.rpm
sudo dnf install omx-clap-host
</code></pre>
<p>Debian bookworm and trixie and Raspberry Pi OS (amd64 and arm64):</p>
<pre><code>cd /tmp &amp;&amp; curl -fsSLO https://www.openmixer.org/deb/openmixer-release.deb &amp;&amp; sudo apt install ./openmixer-release.deb
sudo apt update &amp;&amp; sudo apt install omx-clap-host
</code></pre>
<p>To build on the core: <code>omx-clap-core-devel</code> (<code>libomx-clap-core-dev</code>) and
<code>pkg-config --cflags --libs omx-clap-core</code>.</p>
<h2 id="start">Start</h2>
<pre><code>omx-clap-scan /usr/lib64/clap/lsp-plugins.clap      # what a CLAP file holds
omx-clap-host -n -p 5555                            # prints: omx-clap-host ready!
</code></pre>
<p>In another terminal (messages end in a NUL byte):</p>
<pre><code>send() { printf '%s\\0' &quot;$1&quot; | nc -w3 127.0.0.1 5555 | tr '\\0' '\\n'; }
send &quot;add clap:/usr/lib64/clap/lsp-plugins.clap#in.lsp-plug.limiter_stereo 0&quot;   # resp 0
send &quot;add lv2:urn:zamaudio:ZamComp 1&quot;                                          # resp 1
</code></pre>
<p>Each plugin is now the JACK client <code>effect_&lt;N&gt;</code>, with ports <code>in_&lt;k&gt;</code> and <code>out_&lt;k&gt;</code>.</p>
<h2 id="documentation">Documentation</h2>
<p><a href="https://www.openmixer.org/projects/omx-clap-core">https://www.openmixer.org/projects/omx-clap-core</a>, the manual pages (<code>man omx-clap-host</code>,
<code>man omx-clap-scan</code>), and in this repository: the features, the packages, what CI tests and a
longer walk-through (<a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/docs/overview.md">docs/overview.md</a>); every command
(<a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/doc/reference.md">doc/reference.md</a>); LV2 and CLAP support, row by row
(<a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/docs/lv2-compatibility.md">docs/lv2-compatibility.md</a>,
<a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/docs/clap-compatibility.md">docs/clap-compatibility.md</a>); building from source
(<a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/BUILDING.md">BUILDING.md</a>).</p>
<h2 id="licence">Licence</h2>
<p>GPL-3.0-or-later. See <a href="https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/COPYING">COPYING</a>.</p>
`},{slug:`thread-pool`,src:`docs/thread-pool.md`,title:`The CLAP thread pool`,source:`https://github.com/Open-Mixer/omx-clap-core/blob/587201ce6003e3b311f820beab3e2619ff4bef0a/docs/thread-pool.md`,toc:[{id:`two-paths`,title:`Two paths`},{id:`the-gate-per-plugin-by-its-qualification`,title:`The gate: per plugin, by its qualification`},{id:`measured`,title:`Measured`}],html:`<h1 id="the-clap-thread-pool">The CLAP thread pool</h1>
<p><code>clap.thread-pool</code> lets a plugin split one <code>process()</code> into tasks: inside <code>process()</code> it calls the host's
<code>request_exec(num_tasks)</code>, and the host calls the plugin's <code>exec(plugin, task_index)</code> once for every index from 0 to
<code>num_tasks - 1</code> before <code>request_exec</code> returns. A plugin that splits its voices into tasks then uses as many cores as
the host gives it. This page states how libomx-clap-core runs those tasks, when it spreads them across cores, and what
was measured.</p>
<p><strong>What it gains, and for which plugins.</strong> The pool spreads voices only for a plugin that splits them into tasks. Surge
XT 1.4.0 does not offer <code>clap.thread-pool</code> (no <code>CLAP_EXT_THREAD_POOL</code> in its extension list, no <code>request_exec</code> in its
source), and none of the 489 plugin descriptors on the Raspberry Pi 5 of the measurement mentions the extension. For
every other plugin the cores are used by placement: one worker per instrument or chain, pinned across the cores
(plugin-hostd's <code>placement</code> setting). That, not the pool, is what the Pi gains from first. The pool is the host behaviour
the extension specifies, and the gate by qualification stands for the plugins that use it.</p>
<h2 id="two-paths">Two paths</h2>
<p><strong>Serial.</strong> Every task runs on the calling audio thread, one after the other, before <code>request_exec</code> returns. The
extension allows it, it is real-time safe, and it is what an instance gets unless the pool is granted to it.</p>
<p><strong>Pooled.</strong> The process holds one pool of helper threads, shared by every instance granted it:</p>
<ul>
<li><strong>Size.</strong> N is the number of cores in the worker's CPU affinity mask when the pool is made (<code>sched_getaffinity</code>, so
a worker that plugin-hostd placed on cores gets exactly those); the pool has N - 1 helpers (at most
<code>OMX_CLAP_THREAD_POOL_HELPERS_MAX</code>), and the audio thread is the N-th worker. A mask of one core gives no pool.</li>
<li><strong>Placement.</strong> Each helper is pinned to one core of the mask, every core but the mask's first, which is left to the
audio thread. A helper is named <code>omx-pool-&lt;core&gt;</code> (ps, <code>/proc/&lt;pid&gt;/task/*/comm</code>).</li>
<li><strong>Priority.</strong> A helper runs at the audio thread's scheduling: <code>SCHED_FIFO</code> at the audio thread's real-time priority
(omx-clap-host reads it from JACK, <code>jack_client_real_time_priority</code>), or the normal class when the audio thread is not
real-time. When the priority cannot be set (no <code>CAP_SYS_NICE</code>, an <code>RLIMIT_RTPRIO</code> below it) no pool is made and the
instance runs serial, with one log line naming why: <code>thread pool: serial: SCHED_FIFO &lt;p&gt; refused (&lt;errno&gt;)</code>.
The priority the host is told at the grant is its guess; the audio thread's own is the fact (pipewire-jack answers
<code>jack_client_real_time_priority</code> with an unset value before its thread runs, and a JACK thread may run at another
priority than the one asked). The first request names the audio thread, and the control tick (<code>omx_clap_host_tick</code>)
sets the helpers to its policy and priority, with the log line <code>thread pool: helpers follow the audio thread: SCHED_FIFO &lt;p&gt;</code> (or <code>the normal class</code>); a refusal is said once. A helper left in the normal class gets next to nothing on a busy
machine while the audio thread is real-time: eight 0.3 ms tasks a block, three helpers on a 4-core mask with six busy
loops on their cores, the audio thread ran 808 ms of the 3 s and the helpers 187 to 297 ms each; at the audio thread's
priority 313 ms and 299 to 301 ms each.</li>
<li><strong>Lifetime.</strong> The pool is made by the first activate of an instance granted it and ended by the last deactivate; its
threads are created and joined on the control thread only. Nothing is allocated after the activate.</li>
<li><strong>Parking.</strong> Between requests a helper spins for a few microseconds, then sleeps on a futex. A request wakes the
sleepers with one <code>FUTEX_WAKE</code>, only when some helper is asleep.</li>
<li><strong>Handing out.</strong> The request is published as one 64-bit word: a generation, the task count and the next index. The
helpers and the calling audio thread take indices from it with one compare-and-swap each, so a task is taken
exactly once and no lock is held anywhere. The audio thread takes tasks too: a helper that has not woken yet is never
waited for, the audio thread runs the tasks it would have taken.</li>
<li><strong>Completion.</strong> <code>request_exec</code> returns when every task has finished. The audio thread spins on the completion count
for the length of one block (<code>max_block / rate</code>), then sleeps on the completion futex, which the helper that finishes
the last task wakes. A wait that runs past the block is a <strong>late</strong> event: it is counted in the process's pool
(<code>omx_clap_host_thread_pool</code>) and omx-clap-host adds it to the <code>xruns &lt;count&gt;</code> line it writes on its feedback port,
so plugin-hostd attributes it as it does an xrun. A task a helper has already started is still waited for: returning
before it ends would hand <code>process()</code> back to the plugin while its own task still runs, which the extension forbids.
Tasks nobody has started are never waited for.</li>
<li><strong>Exclusion.</strong> One request holds the pool at a time. A second audio thread that asks while another request holds it
runs its tasks serial. A request made from inside a task, on a helper or on the audio thread, is refused, as before.</li>
<li><strong>The role.</strong> Inside a task, a helper answers <code>clap.thread-check</code>'s <code>is_audio_thread</code> true for the instance whose task
it runs: the helpers are audio threads of that instance for the length of the task.</li>
<li><strong>Limits.</strong> A request of one task, or of more than 65535, runs serial.</li>
</ul>
<h2 id="the-gate-per-plugin-by-its-qualification">The gate: per plugin, by its qualification</h2>
<p>The pool is never a global switch. A plugin gets helper threads only when its qualification measured it real-time safe
(<code>hosting.rt-safety.*</code> clean, with the interposer watching the helper threads too) and faster with the pool at that
quantum; plugin-hostd carries that verdict in the plugin's pin as <code>pool: cores|off</code>. An unmeasured plugin, or one with
violations, runs serial.</p>
<p>In the library the gate is one call per instance, made while it is inactive:
<code>omx_clap_host_thread_pool_use(in, use, rt_priority)</code>. An instance never told to use the pool runs serial.</p>
<p>omx-clap-host takes the verdict on its command line, <code>--thread-pool=qualified|off|on</code>:</p>
<ul>
<li><code>qualified</code> (the default): an instance gets the pool only when the host was told its qualification grants it. The
host has no per-instance verdict input yet, so <code>qualified</code> runs every instance serial until plugin-hostd hands the
verdict over.</li>
<li><code>on</code>: every instance that implements <code>clap.thread-pool</code> gets the pool. plugin-hostd passes it to the worker of a
plugin whose pin says <code>pool: cores</code>; a pinned plugin runs in a worker of its own, so the worker's switch is that
plugin's verdict.</li>
<li><code>off</code>: every instance runs serial.</li>
</ul>
<h2 id="measured">Measured</h2>
<p>Raspberry Pi 5 (4 cores, governor <code>powersave</code>, kernel 6.18 PREEMPT), idle (no stress run), 2026-10-29. Surge XT offers
no <code>clap.thread-pool</code>, and no plugin on the device does, so this is <strong>the fixture plugin</strong>, <code>tests/fake_pool.clap</code>: 16
tasks a block, each rendering 8, 24 or 48 sine voices over the block. The bench (<code>tests/thread_pool_bench.c</code>) is the
audio thread at SCHED_FIFO 70 (jackd's <code>-P 70</code>) on core 0, the pool's three helpers on cores 1 to 3 at the same
priority, each block started at its period for 10 s; the branch was built natively on the Pi with its gcc. Per-block
cost of <code>omx_clap_host_run</code> in microseconds, 48000 Hz:</p>
<table>
<thead>
<tr>
<th>voices/task</th>
<th>frames</th>
<th>budget</th>
<th>off mean</th>
<th>off p99</th>
<th>on mean</th>
<th>on p99</th>
<th>speed-up</th>
<th>helper busy</th>
</tr>
</thead>
<tbody>
<tr>
<td>8</td>
<td>128</td>
<td>2667</td>
<td>263.6</td>
<td>277.1</td>
<td>81.7</td>
<td>86.8</td>
<td>3.2x</td>
<td>2.5% each</td>
</tr>
<tr>
<td>8</td>
<td>256</td>
<td>5333</td>
<td>527.9</td>
<td>534.8</td>
<td>155.9</td>
<td>164.6</td>
<td>3.4x</td>
<td>2.5% each</td>
</tr>
<tr>
<td>8</td>
<td>512</td>
<td>10667</td>
<td>1035.3</td>
<td>1050.2</td>
<td>289.5</td>
<td>296.0</td>
<td>3.6x</td>
<td>2.4% each</td>
</tr>
<tr>
<td>24</td>
<td>128</td>
<td>2667</td>
<td>780.6</td>
<td>793.2</td>
<td>212.9</td>
<td>221.1</td>
<td>3.7x</td>
<td>7.4% each</td>
</tr>
<tr>
<td>24</td>
<td>256</td>
<td>5333</td>
<td>1583.4</td>
<td>1591.1</td>
<td>418.7</td>
<td>425.0</td>
<td>3.8x</td>
<td>7.4% each</td>
</tr>
<tr>
<td>24</td>
<td>512</td>
<td>10667</td>
<td>3242.2</td>
<td>3269.9</td>
<td>845.6</td>
<td>858.0</td>
<td>3.8x</td>
<td>7.6% each</td>
</tr>
<tr>
<td>48</td>
<td>128</td>
<td>2667</td>
<td>1660.9</td>
<td>1683.1</td>
<td>432.3</td>
<td>439.0</td>
<td>3.8x</td>
<td>15.6% each</td>
</tr>
<tr>
<td>48</td>
<td>256</td>
<td>5333</td>
<td>3335.5</td>
<td>3362.7</td>
<td>857.9</td>
<td>863.2</td>
<td>3.9x</td>
<td>15.6% each</td>
</tr>
<tr>
<td>48</td>
<td>512</td>
<td>10667</td>
<td>6603.3</td>
<td>6649.5</td>
<td>1686.6</td>
<td>1699.2</td>
<td>3.9x</td>
<td>15.4% each</td>
</tr>
</tbody>
</table>
<p>No block went over its budget and no wait was late in any run. &quot;Helper busy&quot; is each helper's time inside tasks over
the run's wall time. The 512-frame load of 48 voices, 6.6 ms of the 10.7 ms block serial, takes 1.7 ms on the pool.</p>
<p>Not measured: a real plugin that requests tasks (none on the device does), the pool under JACK's own thread rather
than the bench's, voices until the first xrun, and 96 kHz. The fixture's tasks are equal in size and touch no shared
state, which is the pool's best case.</p>
`}],r={repo:e,commit:t,pages:n};export{t as commit,r as default,n as pages,e as repo};