var e=`plugin-hostd`,t=`a73969e2d024bab73a955c3f260154bdd241255f`,n=[{slug:``,src:`README.md`,title:`README.md`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/README.md`,toc:[{id:`install`,title:`Install`},{id:`start`,title:`Start`},{id:`documentation`,title:`Documentation`},{id:`licence`,title:`Licence`}],html:`<h1 id="plugin-hostd">plugin-hostd</h1>
<p>plugin-hostd runs your LV2 and CLAP audio plugins, each in a worker process of its own, and
puts back any worker that dies. A plugin that crashes takes down its own worker and nothing
else. It speaks mod-host's socket protocol, same ports, same replies, so a mod-host controller
works unchanged; audio never passes through the daemon, every worker is a JACK client. It is for
anyone who runs plugins live on Linux, on a mixing console, a stage rig or a Raspberry Pi.</p>
<p><strong>New here? Read <a href="/projects/plugin-hostd/groupings">How plugins are grouped</a> first.</strong> It draws what a worker, a chain, a plan and a
pool are, and how the benchmark compares them.</p>
<h2 id="install">Install</h2>
<p>Fedora:</p>
<pre><code>sudo dnf install https://www.openmixer.org/rpm/openmixer-release.noarch.rpm
sudo dnf install plugin-hostd omx-clap-host
</code></pre>
<p>Debian bookworm and trixie and Raspberry Pi OS (amd64 and arm64):</p>
<pre><code>curl -fsSLO https://www.openmixer.org/deb/openmixer-release.deb &amp;&amp; sudo apt install ./openmixer-release.deb
sudo apt update &amp;&amp; sudo apt install plugin-hostd omx-clap-host
</code></pre>
<p>omx-clap-host runs both CLAP and LV2 plugins. A plugin it cannot run is refused with a code that says why, and is
never handed to another host. mod-host runs LV2 plugins only when you choose it (<code>lv2_worker mod-host</code>).</p>
<h2 id="start">Start</h2>
<p>Start the daemon, with pin checking off for a first try (it says when both ports accept):</p>
<pre><code>echo 'require_pins 0' &gt; plugin-hostd.conf
plugin-hostd -n -p 5555 -c plugin-hostd.conf
</code></pre>
<p>Then drive it on port 5555 as you would mod-host: <code>add</code>, <code>param_set</code>, <code>connect</code>. <code>man plugin-hostd</code>
has the options.</p>
<h2 id="documentation">Documentation</h2>
<ul>
<li><a href="https://www.openmixer.org/projects/plugin-hostd">https://www.openmixer.org/projects/plugin-hostd</a>, and the documentation at <a href="https://www.openmixer.org/docs">https://www.openmixer.org/docs</a>.</li>
<li>In the source tree: how plugins are grouped into workers, drawn, in <a href="/projects/plugin-hostd/groupings">docs/groupings.md</a>; the whole
guide, with the protocol, placement, grouping, pins and formats, in <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md">docs/guide.md</a>; using it from your own host in <a href="/projects/plugin-hostd/own-host">docs/own-host.md</a>.</li>
</ul>
<p>Building from source: see <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/BUILDING.md">BUILDING.md</a>.</p>
<h2 id="licence">Licence</h2>
<p>GPL-3.0-or-later. See <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/COPYING">COPYING</a>.</p>
`},{slug:`groupings`,src:`docs/groupings.md`,title:`docs/groupings.md`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/groupings.md`,toc:[{id:`the-words`,title:`The words`},{id:`the-four-hosts`,title:`The four hosts`},{id:`the-six-arrangements`,title:`The six arrangements`},{id:`the-comparison`,title:`The comparison`},{id:`what-each-row-measures`,title:`What each row measures`}],html:`<h1 id="how-plugins-are-grouped">How plugins are grouped</h1>
<p>The same plugins can be packed into processes in different ways. Each way trades CPU and memory against safety: how
much else stops when one plugin crashes. This page names the pieces, draws the six arrangements the benchmark measures,
and says what each benchmark row measures. The exact rules are in the <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md">guide</a>; the benchmark itself is
<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/bench/README.md">bench/README.md</a>.</p>
<h2 id="the-words">The words</h2>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-nesting.svg" alt="A dashed grey JACK graph holds a teal worker, which holds an amber chain, which holds three plugins in series"></p>
<p>The pieces always nest in the same order, and every drawing on this page uses the same colours: the JACK graph dashed
grey, a process blue, a worker teal, a chain amber, a pool violet, a worker of an isolated plugin red, a plugin a white
chip.</p>
<ul>
<li><strong>JACK graph.</strong> The audio server that moves sound between programs, one block of samples at a time, at one sample
rate (48000, 96000) and one block size, the quantum (64, 128, 256 frames). Every program on it is a JACK client with
ports of its own, and every block JACK wakes the clients in the order of the links. A block that is not done in time
is an xrun, an audible click.</li>
<li><strong>Plugin.</strong> One effect or instrument: a compressor, a delay, a synth. It is a library in the CLAP or LV2 format, not
a program, so it runs only inside a host.</li>
<li><strong>Process.</strong> A running program with memory of its own. A plugin that crashes kills its process, and every other
plugin in that process with it. More processes give more isolation, and cost more memory and more switching between
them every block.</li>
<li><strong>Worker.</strong> A process plugin-hostd starts to run plugins: omx-clap-host for CLAP, and for LV2 through its adapter, or
mod-host for LV2 when <code>lv2_worker</code> names it (<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md#who-runs-an-lv2-plugin">Who runs an LV2 plugin</a>). The daemon
only takes commands and starts and restarts workers; audio never passes through it. The placement of each <code>add</code>, a
<code>chain</code> or a <code>plan</code> says which plugins a worker holds.</li>
<li><strong>Chain.</strong> Plugins in series inside one worker, declared by <code>chain</code> or by a segment of a <code>plan</code>. A worker that runs a
chain in one JACK client (omx-clap-host) passes the sound from one plugin to the next in memory; one that does not
(mod-host) keeps a client per plugin. One crash stops the whole chain.</li>
<li><strong>Pool.</strong> A shared worker named by the placement <code>pool:&lt;name&gt;</code>. It takes plugins that may share a worker wherever they
sit in the signal path, so each does not need a worker of its own. A full pool, <code>pool_max</code> instances (8 by default),
opens a sibling, <code>&lt;name&gt;#2</code>.</li>
</ul>
<p>Two more words matter. A <strong>host</strong> is the program that loads the plugins; the benchmark compares four (below). A
<strong>pin</strong> is what plugin-hostd holds for each plugin: the SHA-256 of its files, its parameter layout and, once the
qualification has checked the plugin for crashes and real-time safety, a verdict (<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md#pins">Pins</a>). While pins
are checked, only a plugin whose pin says <code>verdict=in-process</code> may share a worker. <code>verdict=isolated</code> keeps it alone,
and so does a pin with no verdict yet. <code>verdict=refused</code> is not loaded at all.</p>
<h2 id="the-four-hosts">The four hosts</h2>
<table>
<thead>
<tr>
<th>In the bench</th>
<th>Host</th>
<th>What it is</th>
<th>Formats</th>
</tr>
</thead>
<tbody>
<tr>
<td>H1</td>
<td>omx-clap-host</td>
<td>OpenMixer's host: one process holding every plugin, driven over the mod-host protocol.</td>
<td>CLAP, and LV2 through its adapter</td>
</tr>
<tr>
<td>H2</td>
<td>plugin-hostd</td>
<td>The daemon: plugins in workers it supervises, alone or grouped in chains, plans and pools. Its workers are omx-clap-host.</td>
<td>CLAP and LV2</td>
</tr>
<tr>
<td>H3</td>
<td>mod-host</td>
<td>The MOD project's host: one process holding every plugin.</td>
<td>LV2</td>
</tr>
<tr>
<td>H4</td>
<td>jalv</td>
<td>A minimal host: one process per plugin, always.</td>
<td>LV2</td>
</tr>
</tbody>
</table>
<h2 id="the-six-arrangements">The six arrangements</h2>
<p>The first four drawings run the same three plugins, omx-comp, omx-delay and omx-drive, between the test signal (a sine,
or chords for an instrument) and the output. The plan and the pool are drawn on the eight plugins of the <code>grp8</code>
scenario, since a plan needs isolated plugins to cut it.</p>
<h3 id="individual">Individual</h3>
<p>H2 with placement <code>own</code>; H4 (jalv), always.</p>
<p>Every plugin gets a process of its own, and the sound goes out through JACK and back in between each plugin. Under
plugin-hostd the processes are workers and the daemon stands beside them; jalv runs one process per plugin with nothing
above them.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-individual.svg" alt="Three teal workers, each holding one plugin, linked in series through JACK; the plugin-hostd daemon sits outside the graph and only sends commands"></p>
<ul>
<li>Processes: one per plugin (3), plus the daemon under plugin-hostd. JACK clients: 3.</li>
<li>A crash: stops one plugin. plugin-hostd starts its worker again and puts back the links it made; a jalv that dies
stays dead.</li>
<li>The trade-off: the safest and the most expensive. Three programs in memory, and JACK switches between three
processes every block.</li>
</ul>
<h3 id="shared-process">Shared process</h3>
<p>H1 (omx-clap-host) and H3 (mod-host).</p>
<p>One host program holds every plugin. Each plugin is still a JACK client of its own inside that process, and the host
links them in series through JACK.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-shared.svg" alt="One blue host process holding three plugins, each a JACK client, linked in series through JACK"></p>
<ul>
<li>Processes: 1. JACK clients: 3.</li>
<li>A crash: stops all three, and nothing starts the host again. The <code>kill1</code> scenario ends <code>failed</code> with the note
<code>host process lost</code> for H1, H3 and H4.</li>
<li>The trade-off: the cheapest in memory and in switching. One faulty plugin takes the whole host down.</li>
</ul>
<h3 id="chain">Chain</h3>
<p>H2, <code>chain 1 &lt;instances&gt;</code>.</p>
<p>plugin-hostd first adds each plugin in a worker of its own, then <code>chain</code> moves them all into one worker: each member's
state is saved, it is removed from its worker and replayed in the chain's. The daemon stays outside the sound path and
only gives orders.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-chain.svg" alt="The plugin-hostd daemon above one teal worker holding an amber chain of three plugins in series"></p>
<ul>
<li>Processes: one worker, plus the daemon. JACK clients: 1 for a CLAP chain under omx-clap-host.</li>
<li>A crash: stops the chain. The daemon starts the worker again, the member that crashed it is quarantined to a worker of
its own, and the chain goes on without it until <code>quarantine_clear</code>.</li>
<li>The trade-off: as cheap as a shared process, run by a supervisor that restarts it.</li>
</ul>
<h3 id="chain-added-in-place">Chain, added in place</h3>
<p>H2, each plugin added with <code>add &lt;uri&gt; &lt;instance&gt; chain:1</code>.</p>
<p>The same result as a chain, built another way: each plugin is added straight into the chain's worker and never gets a
worker of its own first. This row measures what it costs to build the chain, not only to run it. A plugin the chain
refuses (a width its head does not take) is added <code>own</code> instead, as Zynthian adds it, and the row's note says how many.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-chain-add.svg" alt="Three add commands ending in chain:1 lead to one teal worker holding an amber chain of three plugins"></p>
<ul>
<li>Processes: one worker, plus the daemon, plus one per plugin added <code>own</code>. Workers started and dropped on the way: 0.</li>
<li>A crash: as for a chain.</li>
<li>The trade-off: a chain's running cost, with no worker started and stopped while the strip is built.</li>
</ul>
<h3 id="plan">Plan</h3>
<p>H2, <code>grouping on</code>, pins checked, a verdict per plugin, then <code>plan 1 &lt;instances&gt;</code>.</p>
<p>plugin-hostd's planner reads each plugin's pin and cost, and its running history on this machine, and decides which
runs of consecutive plugins share a worker. A run of two or more becomes a chain of place <code>chain:1.&lt;k&gt;</code>, <code>k</code> counting
the segments from 0. A plugin that shares with no neighbour, an isolated one among them, is placed <code>own</code>. <code>plan_get</code>
says why each plugin was left alone (<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/data/grouping.json">data/grouping.json</a> lists the reasons). With the setting
<code>grouping</code> off, the default, the plan is only answered and nothing moves.</p>
<p><code>grp8</code> runs comp, drive, delay, drive, comp, comp, drive, delay, with every drive pinned isolated and the rest
in-process. By the rules above that is seven segments: the two comps that sit next to each other share a worker, each
drive is alone, and three plugins are alone because both their neighbours are isolated drives.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-plan.svg" alt="The eight plugins of grp8 in seven workers: three red isolated drives, one teal worker holding a chain of two comps, and three teal workers each holding one plugin with no neighbour to share with"></p>
<ul>
<li>Processes: one worker per segment (7 for <code>grp8</code>), plus the daemon.</li>
<li>A crash: stops the segment it happens in. An isolated plugin takes down only itself.</li>
<li>The trade-off: the isolation the pins ask for, and sharing everywhere else. A plan that comes back as one segment
is a <code>failed</code> row, since nothing was left for the pins to cut and it would repeat the chain row.</li>
</ul>
<h3 id="pool">Pool</h3>
<p>H2, the same plan, then <code>pool:g1</code>.</p>
<p>Start from the plan. Every plugin the plan left in a worker of its own but whose pin lets it share is removed and added
again with the placement <code>pool:g1</code>, so they all move into one shared worker. The isolated plugins stay alone. The row
fails unless the daemon forms the pool from exactly the plugins moved into it.</p>
<p><img src="https://raw.githubusercontent.com/Open-Mixer/plugin-hostd/a73969e2d024bab73a955c3f260154bdd241255f/docs/img/grouping-pool.svg" alt="The same eight plugins in five workers: one violet pool worker holding 0 comp, 2 delay and 7 delay, one teal worker holding the chain of 4 comp and 5 comp, and three red isolated drives"></p>
<ul>
<li>Processes: 5 workers for <code>grp8</code> instead of 7 for the plan and 8 one per plugin, plus the daemon.</li>
<li>A crash: in the pool, stops every plugin it holds; in an isolated worker, only that plugin.</li>
<li>The trade-off: the fewest processes that still respect every pin. The signal still flows through JACK in the
strip's order; the pool only changes which worker holds each plugin. One strip is one chain, so the pool holds that
strip's leftovers.</li>
</ul>
<p><code>grp16</code> repeats the same five-plugin cycle over 16 plugins: 13 segments in the plan (three chains of two comps, six
isolated drives, four plugins alone) and 10 workers once those four share the pool.</p>
<h2 id="the-comparison">The comparison</h2>
<p>The benchmark compares five rows. Four hosts make five because omx-clap-host is measured on both of its formats, and
plugin-hostd both one plugin per worker and grouped. In the documents <code>bench/run.sh</code> writes, each of these is one row per
scenario, mode, sample rate, block size and load.</p>
<table>
<thead>
<tr>
<th>Row</th>
<th>Host</th>
<th>Arrangement</th>
<th>Scenarios</th>
</tr>
</thead>
<tbody>
<tr>
<td>1. jalv</td>
<td>H4</td>
<td>individual</td>
<td><code>cvc3</code> to <code>cvc48</code> and <code>cvl3</code> to <code>cvl48</code>, both with the LV2 builds</td>
</tr>
<tr>
<td>2. mod-host</td>
<td>H3</td>
<td>shared process</td>
<td><code>cvc3</code> to <code>cvc48</code> and <code>cvl3</code> to <code>cvl48</code>, both with the LV2 builds</td>
</tr>
<tr>
<td>3. omx-clap-host, CLAP</td>
<td>H1</td>
<td>shared process</td>
<td><code>cvc3</code> to <code>cvc48</code></td>
</tr>
<tr>
<td>4. omx-clap-host, LV2 adapter</td>
<td>H1</td>
<td>shared process</td>
<td><code>cvl3</code> to <code>cvl48</code></td>
</tr>
<tr>
<td>5. plugin-hostd, single and grouped</td>
<td>H2</td>
<td>individual, chain, chain added in place; plan and pool</td>
<td><code>cvc</code> (CLAP) and <code>cvl</code> (LV2 through the adapter); <code>grp8</code>, <code>grp16</code> (CLAP)</td>
</tr>
</tbody>
</table>
<p>jalv and mod-host run LV2 only, so under the CLAP scenarios they take the LV2 builds of the same plugins and the row's
note says so. Every <code>cvcN</code> has its <code>cvlN</code>: under H1 and H2 the pair is the same host, the same plugins and the same
DSP code in two wrappers, the clean read of the format.</p>
<p>The two families, from the <code>modes</code> table of <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/bench/scenarios.json">bench/scenarios.json</a>:</p>
<ul>
<li><strong>Chains vs processes.</strong> <code>cvc3</code> to <code>cvc48</code> (CLAP) and <code>cvl3</code> to <code>cvl48</code> (LV2): 3, 8, 16, 24, 32 and 48 plugins
cycling omx-comp, omx-delay and omx-drive. Rows: plugin-hostd individual, chain and chain added in place;
omx-clap-host and mod-host shared; jalv individual. It asks how much grouping saves, and how the hosts compare on the
same plugins.</li>
<li><strong>Grouping vs processes.</strong> <code>grp8</code> and <code>grp16</code>: 8 and 16 CLAP plugins cycling omx-comp, omx-drive, omx-delay,
omx-drive, omx-comp, every drive pinned isolated, under plugin-hostd only. Rows: individual, chain, plan and pool. It
asks whether the planner keeps the isolation the pins ask for while costing close to a full chain.</li>
</ul>
<p>The individual and chain rows run with <code>require_pins 0</code>; the plan and pool rows with pins on, the daemon's own pin
store holding the verdicts and no package pins. Other scenarios (<code>cvp</code>, mixed CLAP and LV2; <code>tp10</code>, third-party LV2
effects) are listed in <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/bench/README.md#scenarios">bench/README.md</a>.</p>
<h2 id="what-each-row-measures">What each row measures</h2>
<p>The first four figures are the ones to compare first; the rest explain them. The field names are those of the
<code>omx-bench/1</code> document (<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/bench/README.md#reading-the-numbers">Reading the numbers</a>).</p>
<table>
<thead>
<tr>
<th>Figure</th>
<th>Field</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td>dsp %</td>
<td><code>dsp_load_avg</code>, <code>dsp_load_max</code></td>
<td>JACK's DSP load as the server computes it, read once a second over the window: how much of each block's time goes to processing. Higher means less room before clicks.</td>
</tr>
<tr>
<td>rss MB</td>
<td><code>rss_mb_total</code></td>
<td>resident memory of all the row's processes together, at the end of the window</td>
</tr>
<tr>
<td>add ms</td>
<td><code>add_ms</code></td>
<td>from the first <code>add</code> to the last reply; for a chain and a chain added in place, until the chain runs; for jalv, until the last client is in the graph. How long building the strip takes.</td>
</tr>
<tr>
<td>xruns</td>
<td><code>xruns</code></td>
<td>blocks that came too late in the window: JACK's xrun callbacks, counted by a client of the run's own server, and the server's own log; the larger of the two</td>
</tr>
<tr>
<td>latency</td>
<td><code>latency_frames</code></td>
<td>the capture latency JACK reports at <code>system:playback_1</code>, the longest of its range: the delay from the source to the output as the clients on the path declare it, in frames. Divide by the sample rate for time: 256 frames at 48000 Hz is 5.3 ms. It is declared, not a measured round trip; a host that declares none adds none.</td>
</tr>
<tr>
<td>processes, JACK clients</td>
<td><code>processes</code>, <code>jack_clients</code></td>
<td>how many programs the row runs (the host and every descendant, plugin-hostd's workers included), and how many clients it put on the JACK graph. This is where the arrangements differ most visibly.</td>
</tr>
<tr>
<td>rss, pss MB</td>
<td><code>rss_mb</code>, <code>rss_mb_total</code>, <code>pss_mb_total</code></td>
<td>rss counts a shared library once in every process that maps it, so many processes look larger than they are; pss shares those pages out between the processes, the honest figure for real memory</td>
</tr>
<tr>
<td>cpu %</td>
<td><code>cpu_pct</code></td>
<td>user and system time of the row's processes over the window, in percent of one core, beside JACK's own DSP load</td>
</tr>
<tr>
<td>context switches</td>
<td><code>ctx_switches</code>, <code>ctx_involuntary</code>, <code>ctx_jackd</code>, <code>ctx_jackd_involuntary</code></td>
<td>how often the row's threads were switched out, and how many of those switches were involuntary; then the same for the JACK server, since a graph of more clients costs it switches too</td>
</tr>
<tr>
<td>recover ms</td>
<td><code>recover_ms</code></td>
<td>in the <code>kill1</code> scenario: from <code>kill -9</code> of the process that holds the plugin until its client is back and wired as before. Only plugin-hostd recovers; the other hosts lose their process.</td>
</tr>
<tr>
<td>output level</td>
<td><code>output</code></td>
<td>one second of the strip's output recorded with <code>jack_rec</code>, its level in dB. A silent row is not a pass, and under H1 and H2 a row whose level differs by more than 1 dB from the same plugins run one per worker is marked unstable.</td>
</tr>
</tbody>
</table>
<p>Every row runs at each sample rate and block size of the run (48000 and 96000 Hz, 128 and 256 frames by default), and
the scenarios above run twice: on a quiet machine, and beside a stress load, one busy loop pinned to each core the host
may use and a process that keeps touching 256 MiB. Each row runs three times by default, with the hosts interleaved
(A B C A B C), and the document keeps the median and the spread. A row whose DSP load repeats span more than 10 % of
their median (and more than 0.3 points) is run once more on its own, and if it still does, it is marked unstable and no
ratio is made from it. The same holds for the other checks of <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/bench/README.md#the-soundness-gate">the soundness gate</a>:
twins, stress, scaling, machine state and output.</p>
<p>The private JACK server of a run uses the dummy driver unless <code>--alsa hw:X</code> names an audio interface, and it never
touches a JACK server already running on the machine.</p>
`},{slug:`formats`,src:`docs/formats.md`,title:`docs/formats.md`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/formats.md`,toc:[{id:`the-tables`,title:`The tables`},{id:`the-transforms`,title:`The transforms`},{id:`the-coverage-test`,title:`The coverage test`},{id:`the-field-dump`,title:`The field dump`},{id:`the-descriptor-describe-writes`,title:"The descriptor `describe` writes"}],html:`<h1 id="the-format-tables-how-a-scan-becomes-a-descriptor">The format tables: how a scan becomes a descriptor</h1>
<p>plugin-hostd turns what a CLAP or LV2 plugin states about itself into a <code>scanned</code> descriptor (omx-contract
<code>docs/descriptors.md</code>). Three layers do it, and each is one thing:</p>
<table>
<thead>
<tr>
<th>Layer</th>
<th>What</th>
<th>Where</th>
</tr>
</thead>
<tbody>
<tr>
<td>L1 description</td>
<td>one mapping table per format, data: every field a scan reads, mapped to a descriptor word, carried in the extension bag, or dropped by a named decision</td>
<td><code>data/formats/clap.json</code> (<code>PLUGIN_HOSTD_CLAP_MAP</code>), <code>data/formats/lv2.json</code> (<code>PLUGIN_HOSTD_LV2_MAP</code>), item kind <code>formatMap</code></td>
</tr>
<tr>
<td>L2 transforms</td>
<td>a closed list of named functions, each with its inverse, which a table names and never defines</td>
<td><code>src/transforms.h</code> (<code>TRANSFORMS(X)</code>), <code>src/transforms.c</code></td>
</tr>
<tr>
<td>L3 runtime</td>
<td>the field dump of one plugin, read as a host reads it</td>
<td>omx-clap-core's <code>omx-clap-scan --fields</code></td>
</tr>
</tbody>
</table>
<p><code>plugin-hostd-probe describe</code> joins them: it runs the dump in an isolated child, applies the table and its transforms,
and writes the descriptor. The same tables, read backwards, are what omx-plugins' generators write a CLAP face and an
LV2 <code>.ttl</code> from: one vocabulary, two directions, and the round trip (author, generate both faces, scan back, compare)
is the proof.</p>
<h2 id="the-tables">The tables</h2>
<p><code>make install-contract</code> installs both tables, with omx-contract-devel's <code>install-contract-dir.sh</code>, as the package
<code>plugin-hostd</code> of the contract directory: <code>&lt;contractdir&gt;/3/plugin-hostd/formats/{clap,lv2}.json</code>, with its
<code>MANIFEST.json</code>, beside the daemon's verbs (<code>verbs.json</code>). The noarch package plugin-hostd-contract
(<code>plugin-hostd-contract</code> on Debian too) ships them, and a program that reads them at run time requires it.
It requires omx-contract 3.2.0 or later (<code>Requires</code>, Debian <code>Depends</code>): the tables live in omx-contract's contract
directory and are read against its schema, and 3.2.0 is the first whose source field takes an index
(<code>omx_clap_panel_display.meter_ids[0]</code>), so an older omx-contract never sits beside a table it refuses.</p>
<p><code>make check-contract-dir</code> installs the package into a staging directory and runs <code>omx-contract validate</code> over it
together with the installed contract directory (omx-contract's own tables, omx-clap-core's): red on any table the
installed schema refuses, and red, never a skip, when the <code>omx-contract</code> command is absent. The coverage test below
walks the schema for the words only, never for the row keys; this gate reads every key as a reader of the installed
directory does.</p>
<p>A table's <code>rows</code> are keyed by the source field, and each row has exactly one class:</p>
<table>
<thead>
<tr>
<th>Class</th>
<th>Carries</th>
<th>Meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>word</code></td>
<td><code>{ word, transform, values? | factor? }</code></td>
<td>the descriptor word it becomes (<code>controls[].travel.unit</code>), the transform that converts it (a name of <code>TRANSFORMS(X)</code>) and that transform's data: <code>values</code> for <code>lookup</code>, <code>factor</code> for <code>scale-by</code>. Never code</td>
</tr>
<tr>
<td><code>extension</code></td>
<td><code>true</code></td>
<td>carried verbatim into the descriptor's <code>extensions.&lt;format&gt;.&lt;field&gt;</code> (a record of a control's or a port's scope under <code>&lt;scope&gt;/&lt;field&gt;</code>)</td>
</tr>
<tr>
<td><code>dropped</code></td>
<td><code>{ ruling }</code></td>
<td>left out, by the decision it names: a spec path and section, or the TERM's own <code>out-of-scope</code> mark</td>
</tr>
</tbody>
</table>
<p>A record of the plugin's scope whose row is a control's or a port's word (<code>controls[].*</code>, <code>ports[].*</code>) says that field of
the plugin, not of a control: LV2 lets a plugin carry its own <code>lv2:symbol</code>, and mda Piano does. It is carried as an
extension (<code>extensions.lv2.lv2:symbol</code>), never refused and never read as a control.</p>
<p>Each row names what it covers, one of two: <code>term</code>, a TERM of omx-contract's format files (<code>LV2_UNITS_TERMS#unit</code>), or
<code>from</code>, the header or specification link of a field no TERM file lists (the CLAP struct fields and <code>clap_entry</code>,
<code>rdf:type</code>, <code>rdfs:comment</code>, <code>rdfs:seeAlso</code>, <code>doap:name</code>, <code>doap:license</code>).</p>
<h3 id="field-names">Field names</h3>
<p>The key of a row is the field as the dump names it:</p>
<ul>
<li>a CLAP TERM: its <code>id</code> (<code>CLAP_PARAM_IS_STEPPED</code>, <code>CLAP_EXT_LATENCY</code>, <code>CLAP_PLUGIN_FEATURE_DELAY</code>);</li>
<li>a CLAP struct field: <code>&lt;struct&gt;.&lt;member&gt;</code> as the headers spell them (<code>clap_param_info.min_value</code>), or
<code>&lt;struct&gt;.&lt;function&gt;</code> for what a call returns (<code>clap_plugin.get_extension</code>, <code>clap_plugin_params.value_to_text</code>);</li>
<li>an LV2 TERM: <code>&lt;prefix&gt;:&lt;term&gt;</code>, the term's own name under the prefix of its specification (<code>units:db</code>,
<code>lv2:toggled</code>, <code>pg:group</code>, <code>units:units.lv2</code> for the specification itself);</li>
<li>any other LV2 predicate: its usual CURIE (<code>rdf:type</code>, <code>rdfs:comment</code>, <code>doap:name</code>).</li>
</ul>
<p>The LV2 prefixes: <code>lv2</code> lv2core, <code>atom</code>, <code>bufsz</code> buf-size, <code>da</code> data-access, <code>dman</code> dynmanifest, <code>ev</code> event,
<code>ia</code> instance-access, <code>log</code>, <code>midi</code>, <code>morph</code>, <code>opts</code> options, <code>param</code> parameters, <code>patch</code>, <code>pg</code> port-groups,
<code>pprops</code> port-props, <code>pset</code> presets, <code>rsz</code> resize-port, <code>state</code>, <code>time</code>, <code>ui</code>, <code>units</code>, <code>urimap</code> uri-map, <code>urid</code>,
<code>work</code> worker; and <code>rdf</code>, <code>rdfs</code>, <code>doap</code>, <code>foaf</code> for the W3C and DOAP vocabularies.</p>
<h3 id="field-rows-and-value-rows">Field rows and value rows</h3>
<p>Some TERMs are fields (<code>lv2:minimum</code>, <code>units:unit</code>); others are values a field takes (<code>units:db</code> is a value of
<code>units:unit</code>, <code>lv2:toggled</code> of <code>lv2:portProperty</code>, <code>CLAP_PARAM_IS_STEPPED</code> of <code>clap_param_info.flags</code>). Every TERM has
its row either way. A record of the dump is resolved in this order:</p>
<ol>
<li>when its value is the key of a row (a value row): a <code>word</code> row converts it, a <code>dropped</code> row drops it, an <code>extension</code>
row says the value has no word of its own and defers to the field's row;</li>
<li>otherwise the field's row: a <code>word</code> row converts the value (a <code>lookup</code> that has no entry for it carries the value
in the bag instead), an <code>extension</code> row carries it in the bag, a <code>dropped</code> row drops it;</li>
<li>a field with no row at all is refused: <code>describe</code> names it and writes no descriptor.</li>
</ol>
<p>A value row's <code>lookup</code> holds its own pair (<code>units:db</code> -&gt; <code>dB</code>): the unit rows are the same correspondence as
omx-plugins' <code>LV2_UNITS</code> (<code>tools/gen.mjs</code>), and where the TERM file names the unit's word the row maps to that word,
which the coverage test holds.</p>
<h3 id="what-a-table-drops">What a table drops</h3>
<p>A row is <code>dropped</code> only by a decision it names. The TERMs omx-contract marks <code>out-of-scope</code> are dropped by that mark,
which the row quotes. A field this section rules out is dropped by <code>docs/formats.md#what-a-table-drops</code>:</p>
<ul>
<li>a runtime handle that is no fact of the plugin (<code>clap_param_info.cookie</code>, a pointer the host passes back);</li>
<li>every field of the panel description (<code>omx_clap_plugin_panel_description.*</code> and the <code>omx_clap_panel_*</code> structures of
omx-clap-core's <code>omx_clap_ext.h</code>): the panel travels whole, as the scan's <code>panel</code> object, by <code>panel_get</code>
(<a href="/projects/plugin-hostd/panel">panel.md</a>), and the descriptor carries none of it. A panel field's row is a drop and nothing else;
<code>describe</code> refuses a table that makes one a word or the bag.</li>
</ul>
<p>A TERM omx-contract marks <code>used</code> is never dropped: its row is a word or the bag.</p>
<h3 id="outbound-read-rows">Outbound-read rows</h3>
<p>A generator reads a value row of a table to write a face: the TERM is a value (not a <code>property</code>) and omx-contract
lists omx-plugins among its users (<code>by</code>). Such a row's transform is <code>identity</code> or <code>lookup</code>, the two a generator applies
by reading the table alone; what is structure (scale points, groups, module paths) stays in the generator's code.</p>
<h2 id="the-transforms">The transforms</h2>
<p><code>src/transforms.h</code> declares the closed list as one X-macro, <code>TRANSFORMS(X)</code>: the name a table writes, the inbound
function (format to descriptor) and its inverse (descriptor to format), all prefixed <code>transforms_</code>. A value crosses as
text: a JSON literal on the descriptor side (<code>-60</code>, <code>&quot;dB&quot;</code>, <code>true</code>, <code>[&quot;Filter&quot;,&quot;Envelope&quot;]</code>), the dump's text on the
format side.</p>
<table>
<thead>
<tr>
<th>Name</th>
<th>Inbound</th>
<th>Inverse</th>
<th>Data</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>identity</code></td>
<td>the value as it is, a number as a number</td>
<td>the same</td>
<td>none</td>
</tr>
<tr>
<td><code>lookup</code></td>
<td>the value's entry in <code>values</code></td>
<td>the key whose entry it is</td>
<td><code>values</code>, one to one: a table whose values repeat is refused</td>
</tr>
<tr>
<td><code>scale-by</code></td>
<td>the number times <code>factor</code></td>
<td>the number divided by <code>factor</code></td>
<td><code>factor</code>, not zero</td>
</tr>
<tr>
<td><code>flag</code></td>
<td>present -&gt; <code>true</code></td>
<td><code>true</code> -&gt; the row's key, <code>false</code> -&gt; nothing</td>
<td>none</td>
</tr>
<tr>
<td><code>scale-points</code></td>
<td><code>&lt;number&gt; &lt;label&gt;</code> -&gt; one point of the control's <code>values</code> and <code>labels</code></td>
<td>the point back as <code>&lt;number&gt; &lt;label&gt;</code></td>
<td>none</td>
</tr>
<tr>
<td><code>group-path</code></td>
<td>a CLAP module path <code>a/b</code> -&gt; the group <code>[&quot;a&quot;,&quot;b&quot;]</code></td>
<td>the group joined by <code>/</code></td>
<td>none</td>
</tr>
<tr>
<td><code>port-group</code></td>
<td>an LV2 group's label -&gt; the group <code>[&quot;label&quot;]</code>; a <code>pg:subGroupOf</code> label -&gt; a level put before the group read so far</td>
<td>the path's last level, the group a port names</td>
<td>none</td>
</tr>
</tbody>
</table>
<p>A new transform is added when a row needs it, never before; <code>make test-transforms</code> runs every function and its inverse
over its vectors (in, out, back in, equal).</p>
<h2 id="the-coverage-test">The coverage test</h2>
<p><code>make test-format-coverage</code> runs <code>tests/format_coverage.py</code> once per format. The field list is every term of the
installed TERM files (<code>&lt;contractdir&gt;/3/omx-contract/formats/&lt;format&gt;/**</code>) plus every row with a <code>from</code>; each field has
exactly one row. It prints, per field, <code>mapped &lt;word&gt; &lt;transform&gt;</code>, <code>extension &lt;format&gt;</code> or <code>dropped &lt;decision&gt;</code>, then the
count per class. It is red for:</p>
<ul>
<li>a field with no row, and a row that covers no field (its <code>term</code> is no installed term);</li>
<li>a <code>word</code> the descriptor schema lacks (walked in the installed <code>omx-contract.schema.json</code>), or a <code>lookup</code> entry that
is no value the word takes;</li>
<li>a <code>transform</code> that is not in <code>TRANSFORMS(X)</code>, or a <code>lookup</code> that is not one to one;</li>
<li>a <code>used</code> TERM that is <code>dropped</code>, and a <code>dropped</code> row that names no decision;</li>
<li>an outbound-read row whose transform is neither <code>identity</code> nor <code>lookup</code>;</li>
<li>a unit row that does not map to the word its TERM names.</li>
</ul>
<p><code>tests/format_coverage.py --self-test</code> breaks a copy of each table three ways (one row removed, one <code>word</code> misspelt,
one transform renamed) and each arm must go red naming the field.</p>
<h2 id="the-field-dump">The field dump</h2>
<p><code>omx-clap-scan --fields clap:&lt;path&gt;#&lt;id&gt; | lv2:&lt;uri&gt;</code> writes one record per line, TAB-separated:</p>
<pre><code>&lt;scope&gt;	&lt;field&gt;	&lt;value&gt;
</code></pre>
<ul>
<li><code>scope</code>: <code>plugin</code>; <code>param:&lt;index&gt;</code> (CLAP, in <code>clap_plugin_params.get_info</code> order); <code>audio_in:&lt;index&gt;</code>,
<code>audio_out:&lt;index&gt;</code>, <code>note_in:&lt;index&gt;</code>, <code>note_out:&lt;index&gt;</code> (CLAP ports); <code>port:&lt;index&gt;</code> (an LV2 port, by
<code>lv2:index</code>). A scope is a source field's first segment, so a bag key <code>&lt;scope&gt;/&lt;field&gt;</code> is one too. A CLAP plugin
that serves a panel description adds <code>panel</code>, <code>section:&lt;index&gt;</code>, <code>control:&lt;index&gt;</code>, <code>role:&lt;index&gt;</code>,
<code>display:&lt;index&gt;</code> and <code>placement_default:&lt;index&gt;</code> (omx-clap-scan 0.20.0); these scopes are no entry of the
descriptor, and each of their fields is dropped (above).</li>
<li><code>field</code>: a row key, as named above.</li>
<li><code>value</code>: the field's value as text. A number in <code>%.17g</code>; a CLAP constant (a flag bit, a port type, a note dialect,
an extension id, a feature the headers define) by its macro name, one record per flag set or per item; an LV2 URI as
a CURIE under the prefixes above, a URI no prefix covers in full; a scale point or a CLAP value text as
<code>&lt;number&gt; &lt;label&gt;</code>. A TAB or a newline in a text becomes a space.</li>
<li>the provenance: a CLAP dump writes <code>plugin	clap_entry	&lt;file name of the .clap&gt;</code>, an LV2 dump
<code>plugin	rdfs:seeAlso	&lt;bundle directory&gt;/&lt;data file&gt;</code>, the <code>.ttl</code> that describes the plugin.</li>
</ul>
<p>The first line is <code># omx-clap-scan --fields 1</code>, the format's version; a dump with another version is refused.</p>
<h2 id="the-descriptor-describe-writes">The descriptor <code>describe</code> writes</h2>
<p><code>plugin-hostd-probe describe [--table &lt;file&gt;] [--fields-from &lt;dump.tsv&gt;] clap:&lt;path&gt;#&lt;id&gt; | lv2:&lt;uri&gt;</code> writes the
<code>scanned</code> descriptor on stdout, exit 0; 2 when nothing is written (usage, a table it cannot read, a refused dump), 3 when
the dump cannot be made. Without <code>--fields-from</code> it runs <code>omx-clap-scan --fields</code> under the probe runner's limits, in a
child of its own (<code>run</code>'s isolation); with it, it reads a recorded dump, which is what its own tests do.</p>
<p>What the tables leave to <code>describe</code>:</p>
<ul>
<li>each scope is one entry: a CLAP <code>param:</code> scope a control, a CLAP port scope a port, an LV2 <code>port:</code> scope a control
when a row makes it one (<code>lv2:ControlPort</code>) and a port when a row gives it a port kind; <code>id</code> and <code>name</code> follow the
entry;</li>
<li>an LV2 control's kind is <code>travel</code> (its <code>lv2:ControlPort</code> row) unless another record of the port gives a more
specific one (<code>toggle</code>, <code>choice</code>, <code>trigger</code>), whatever order the dump lists the port's records in;</li>
<li>an LV2 travel that states both <code>lv2:integer</code> (stepped) and <code>pprops:logarithmic</code> (log) is <code>log</code>, whatever order the
dump lists them in;</li>
<li>an LV2 output control is <code>readonly</code>; an LV2 port that reports latency (<code>lv2:latency</code>) is no control;</li>
<li>consecutive LV2 audio ports of one direction, role and group are one port, its <code>channels</code> their count, its layout
<code>mono</code> or <code>stereo</code> by that count;</li>
<li>a CLAP port that is not main is <code>aux</code>; a control's <code>unit</code> is <code>unknown</code> when no row sets it, its <code>scale</code> <code>unknown</code>
on CLAP and <code>linear</code> on LV2 (where a scale not stated is linear); its <code>meaning</code> is <code>unknown</code> when no row sets it; a
control with points is a <code>choice</code>, its <code>ids</code> taken from its labels and its default the id of the default's point, a
<code>toggle</code> defaults to its default being non-zero;</li>
<li>an LV2 port's group path is its <code>pg:group</code> label with one <code>pg:subGroupOf</code> record per group above it, nearest first
(the scanner follows the chain, <code>lv2:name</code> else <code>rdfs:label</code> of each group); the path is read outermost first, and a
<code>pg:subGroupOf</code> with no <code>pg:group</code> before it is refused;</li>
<li>the bag holds a field's one value as it is, two or more as a list;</li>
<li>a plugin no feature of which maps is an <code>audio-effect</code>; an LV2 plugin's <code>id</code> and <code>uri</code> are the URI asked for;</li>
<li>the links a scanned descriptor needs (<code>source.from</code>): a CLAP descriptor's own, <code>&lt;file&gt;#clap_entry</code>; each LV2
control's, <code>&lt;data file&gt;#&lt;symbol&gt;</code>, from the row of <code>clap_entry</code> and of <code>rdfs:seeAlso</code>; a character a link cannot hold
becomes <code>_</code>; <code>instrument</code> is written when the features hold it, <code>polyphonic</code> when it states more than one voice; <code>latency</code>
is always written, <code>reports</code> false when no row sets it.</li>
<li>a word of a table that <code>describe</code> does not write is refused with the table: a new word is code here first.</li>
</ul>
`},{slug:`own-host`,src:`docs/own-host.md`,title:`the highest SCHED_FIFO priority, which the probe asks for, and a lock as large as the probe's memory limit`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/own-host.md`,toc:[{id:`lv2-plugins`,title:`LV2 plugins`},{id:`measuring-plugins-at-real-time-priority`,title:`Measuring plugins at real-time priority`},{id:`what-a-zynthian-integration-still-needs-from-us`,title:`What a Zynthian integration still needs from us`}],html:`<h1 id="use-plugin-hostd-in-your-own-host">Use plugin-hostd in your own host</h1>
<p>This page takes a Debian machine (Raspberry Pi OS, Zynthian, any Debian 12 or 13, arm64 or amd64) from nothing to a
plugin running under plugin-hostd, driven over its socket, in nine commands, and then runs an LV2 plugin the same way in eight more. CI runs every command below, as written, in
a clean Debian container on Debian 12 and 13, on both architectures; a step that stops working fails that job.</p>
<p>The plugin is a CLAP effect from the <code>omx-plugins-clap</code> package, so nothing else has to be installed to try it. Any
host that already speaks mod-host's socket protocol can send the same lines.</p>
<p>The first line of the block is a helper, not counted: one protocol message in, the reply out (a message ends in a NUL
byte, which <code>printf</code> adds). A trailing <code># resp ...</code> or <code># has ...</code> is the reply or output CI expects; to you it is a
comment.</p>
<p>The commands, in order. Run them as a normal user with <code>sudo</code>, or as root:</p>
<pre><code class="language-sh">send() { printf '%s\\0' &quot;$1&quot; | nc -w3 127.0.0.1 5555 | tr '\\0' '\\n'; }
curl -fsSLO https://www.openmixer.org/deb/openmixer-release.deb
sudo apt-get install -y ./openmixer-release.deb
sudo apt-get update &amp;&amp; sudo apt-get install -y plugin-hostd omx-clap-host omx-plugins-clap jackd2 netcat-openbsd
jackd -r -d dummy &gt;/dev/null 2&gt;&amp;1 &amp; sleep 2
plugin-hostd -n -p 5555 &gt;plugin-hostd.log 2&gt;&amp;1 &amp; sleep 2
omx-clap-scan /usr/lib/clap/omx-comp.clap | grep 'param 1 '  # has Ratio [1 .. 20] default 4
send &quot;add clap:/usr/lib/clap/omx-comp.clap#org.openmixer.comp 0&quot;   # resp 0
send &quot;param_set 0 1 8&quot;   # resp 0
send &quot;param_get 0 1&quot;   # resp 0 8.0000
</code></pre>
<p>What each step did:</p>
<ol>
<li><code>curl</code> fetches the repository key of the FreeMixer channel. It signs every package, for x86_64 and arm64.</li>
<li>The <code>echo</code> adds the channel for your Debian release (<code>bookworm</code> and <code>trixie</code> are published).</li>
<li><code>apt-get install</code> takes the daemon, the CLAP worker <code>omx-clap-host</code>, a set of CLAP plugins to try, and JACK. On a
machine that already runs JACK (Zynthian does) leave <code>jackd2</code> out.</li>
<li><code>jackd -r -d dummy</code> starts a JACK server that needs no sound card. On a real machine use the one you have.</li>
<li><code>plugin-hostd -n -p 5555</code> starts the daemon on the command port, 5555. It prints <code>plugin-hostd ready!</code> once the port
accepts. No worker exists until the first <code>add</code>. The ports listen on 127.0.0.1; a controller on another machine needs
<code>--bind-address</code> (<code>man plugin-hostd</code>).</li>
<li><code>omx-clap-scan</code> reads the plugin's layout: every parameter, its number, range and default. The number is the symbol
the protocol takes, so the compressor's Ratio is <code>1</code>.</li>
<li><code>add</code> loads the plugin as instance <code>0</code>. The daemon starts a worker of its own for it, a JACK client named
<code>effect_0</code>, and puts it back if it dies.</li>
<li><code>param_set</code> sets Ratio to 8.</li>
<li><code>param_get</code> reads it back.</li>
</ol>
<h2 id="lv2-plugins">LV2 plugins</h2>
<p>Zynthian's plugins are mostly LV2. <code>omx-clap-host</code>, which you already installed, also runs an LV2 plugin through its LV2
adapter; the LV2 build of the same plugins is the package <code>omx-plugins-lv2</code>. Continue in the same shell, with the
<code>send</code> helper of the first block and JACK still running. <code>lv2_worker</code> names the program that runs LV2 plugins, and
<code>mod-host</code> is the default, so the daemon is restarted with <code>omx-clap-host</code> named in its configuration file. An LV2
plugin is added by its URI with an <code>lv2:</code> prefix, and its parameters are named by their LV2 symbol (<code>ratio</code>), not by a
number.</p>
<pre><code class="language-sh">send &quot;quit&quot;; sleep 1   # resp 0
sudo apt-get install -y omx-plugins-lv2
echo &quot;lv2_worker omx-clap-host&quot; &gt; plugin-hostd.conf
plugin-hostd -n -p 5555 -c plugin-hostd.conf &gt;plugin-hostd-lv2.log 2&gt;&amp;1 &amp; sleep 2
send &quot;add lv2:urn:openmixer:comp 0&quot;   # resp 0
send &quot;param_set 0 ratio 8&quot;   # resp 0
send &quot;param_get 0 ratio&quot;   # resp 0 8.0000
send &quot;worker_list&quot;   # has :lv2-clap:
</code></pre>
<ol>
<li><code>quit</code> stops the daemon and the worker of the first block.</li>
<li><code>apt-get install</code> adds the LV2 bundles under <code>/usr/lib/lv2</code>, where the daemon searches.</li>
<li>The configuration file makes <code>omx-clap-host</code> the worker of LV2 plugins.</li>
<li>The daemon starts again with it.</li>
<li><code>add</code> loads the plugin by its URI as instance <code>0</code>, in a worker of its own.</li>
<li>and 7. <code>param_set</code> and <code>param_get</code> set and read back the compressor's Ratio by its symbol.</li>
<li><code>worker_list</code> names the worker of each instance; <code>lv2-clap</code> is <code>omx-clap-host</code> running an LV2 plugin.</li>
</ol>
<p>CI also sends a sine into the instance's JACK ports and measures what comes out, with the Makeup gain set to 6 dB and
Ratio to 1: the output peak must be 1.995 times the input's.</p>
<p>Pins need nothing from you. A plugin has to be pinned (its files' hashes and its parameter layout) before the daemon
lets it run; in the default <code>first-use</code> mode the first <code>add</code> records the pin in <code>$XDG_STATE_HOME/plugin-hostd/pins</code>, and
a later <code>add</code> of a changed file is refused with a <code>pin_changed</code> event. A host that pins by itself sets <code>pin_mode strict</code>.
See Pins in the <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md#pins">guide</a>.</p>
<p>What to read next: <code>man plugin-hostd</code>; the verbs and error codes in the <a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/guide.md">guide</a>; <code>remote_pages</code> and <code>remote_page_get</code> for
the plugin's own pages of controls; the machine-readable protocol at
<code>/usr/share/plugin-hostd-protocol/plugin-hostd.json</code>; a C consumer can include <code>plugin-hostd/protocol.h</code>
(<code>pkg-config --cflags plugin-hostd-protocol</code>, package <code>libplugin-hostd-protocol-dev</code>).</p>
<h2 id="measuring-plugins-at-real-time-priority">Measuring plugins at real-time priority</h2>
<p><code>plugin-hostd-probe</code> measures a plugin on a SCHED_FIFO thread at the highest priority it is granted, with its memory
locked, as JACK or PipeWire runs it; without a grant the figures are taken at ordinary priority, and the record says so
(<code>run.realtime.class: none</code> and the reason). On Zynthian and on the console, plugin-qualify's sync service
(<code>plugin-qualify-sync.service</code>) runs the probe; it passes the grant with a drop-in,
<code>/etc/systemd/system/plugin-qualify-sync.service.d/realtime.conf</code>:</p>
<pre><code class="language-ini">[Service]
# the highest SCHED_FIFO priority, which the probe asks for, and a lock as large as the probe's memory limit
LimitRTPRIO=99
LimitMEMLOCK=infinity
# the unit forbids real time to everything it starts; the probe bounds it instead (RLIMIT_RTPRIO, RLIMIT_RTTIME)
RestrictRealtime=no
</code></pre>
<p>then <code>sudo systemctl daemon-reload</code>. Where the distribution lets a service hold capabilities,
<code>AmbientCapabilities=CAP_SYS_NICE</code> grants the same priority without the rlimit; a CI job whose container holds CAP_SYS_NICE
and no CAP_SYS_RESOURCE runs the probe's real-time arm on that route, so the record's <code>grantedBy: cap</code> is measured on every
push. A unit without <code>User=</code> runs the probe as root: the measured child then has every capability and the bounding set dropped, and <code>run.realtime.capabilityBound</code> says whether that held (<code>false</code> when the runner lacks <code>CAP_SETPCAP</code>, where only a <code>User=</code> with <code>AmbientCapabilities=</code> keeps the bound). <code>plugin-qualify --all</code>, run by hand,
gets the grant of the user's login session: the <code>rtprio</code> and <code>memlock</code> of <code>/etc/security/limits.d/</code>, as for JACK (for
example the <code>audio</code> group's). <code>plugin-hostd-probe run --list-limits</code> prints what a run would get: the <code>realtime</code> line
names the grant and the priority, or why there is none.</p>
<p>The probe's memory limit is <code>memory.max</code> of a cgroup it makes for the measured child. A service running as root needs nothing
for that. A service under another user needs <code>Delegate=memory</code> in the same drop-in; without it the limit is <code>RLIMIT_DATA</code>, and
the document says so under <code>limits.unavailable</code>.</p>
<h2 id="what-a-zynthian-integration-still-needs-from-us">What a Zynthian integration still needs from us</h2>
<p>Checked in a clean Debian container against published packages. The first item against 0.4.0 of the daemon and 0.10.0 of
the worker and plugins (the page's CI); the others against 0.2.1 of the daemon and 0.8.0 of the worker and plugins, on
trixie, and not re-checked since:</p>
<ul>
<li>An LV2 plugin that the LV2 adapter of <code>omx-clap-host</code> refuses answers <code>-512</code>, and the <code>lv2_adapter_refused</code> event
says why. It is never handed to another host; it is a defect of the adapter to fix.</li>
<li><code>param_info</code> answers <code>-511</code> (the worker holds no checked unit and scale) for every parameter of a CLAP instance with
the released worker, 0.8.0; the daemon passes the answer through. A host reads ranges and defaults from
<code>omx-clap-scan</code> (or <code>omx-clap-scan --json</code>) and not from the socket, until a worker answers <code>resp 0</code>.</li>
<li>Parameters are named by their CLAP number (<code>0</code>, <code>1</code>, ...), not by a name; a host maps names to numbers from the scan.</li>
<li>No Zynthian image was available to CI: the check is on plain Debian arm64, not on Zynthian's own userland (its jackd,
its audio configuration, its realtime limits).</li>
</ul>
<p>Each of these is an issue of its own.</p>
`},{slug:`panel`,src:`docs/panel.md`,title:`docs/panel.md`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/panel.md`,toc:[{id:`the-verb`,title:`The verb`},{id:`where-the-panel-comes-from`,title:`Where the panel comes from`},{id:`the-file`,title:`The file`},{id:`the-format-tables-stay-strict`,title:`The format tables stay strict`},{id:`why-a-verb-of-its-own`,title:`Why a verb of its own`},{id:`drawing-a-panel-the-three-verbs-together`,title:`Drawing a panel: the three verbs together`}],html:`<h1 id="the-panel-a-plugin-publishes-served-to-a-host">The panel a plugin publishes, served to a host</h1>
<p>A plugin of omx-plugins states how its panel is laid out through the CLAP extension
<code>org.openmixer.panel-description/1</code> (omx-clap-core's <code>src/omx_clap_ext.h</code>, omx-plugins' <code>include/omx_panel_description.h</code>):
its family, a fingerprint, and five tables, the sections, the controls (each with its parameter, section, widget and
visibility rule), the roles, the displays and the placement defaults. A host that draws the panel itself, such as
Zynthian's engine, reads it from the daemon with <code>panel_get</code>.</p>
<h2 id="the-verb">The verb</h2>
<pre><code>panel_get &lt;uri&gt;          resp 0 &quot;&lt;path&gt;&quot;
</code></pre>
<p><code>&lt;uri&gt;</code> is the one <code>add</code> takes (<code>clap:&lt;path&gt;#&lt;id&gt;</code>, <code>lv2:&lt;uri&gt;</code>). The reply is the path of the plugin's panel file,
one quoted word as <code>descriptor_get</code> answers its descriptor. The codes are <code>descriptor_get</code>'s:</p>
<table>
<thead>
<tr>
<th>Code</th>
<th>When</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>-529</code></td>
<td>no descriptor, or a descriptor with no panel beside it, for the plugin's binary as it is now: no add since it changed, a binary that cannot be found, a descriptor filed by a daemon that predates <code>panel_get</code></td>
</tr>
<tr>
<td><code>-530</code></td>
<td>the scan of its add has not filed the panel yet: ask again</td>
</tr>
<tr>
<td><code>-531</code></td>
<td>the last scan filed no panel: the descriptor failed, or the panel stage did (the scanner states no panel, see below); the next add scans again</td>
</tr>
<tr>
<td><code>-528</code></td>
<td>descriptor_dir could not be written</td>
</tr>
<tr>
<td><code>-902</code></td>
<td>no <code>&lt;uri&gt;</code>, or more than one word</td>
</tr>
</tbody>
</table>
<h2 id="where-the-panel-comes-from">Where the panel comes from</h2>
<p>The answered <code>add</code> of a plugin whose files have no descriptor runs the scan, in a child of its own, as it does for
<code>descriptor_get</code>. The scan has two stages:</p>
<ol>
<li><code>plugin-hostd-probe describe &lt;target&gt;</code>, whose stdout is the descriptor, filed as
<code>&lt;descriptor_dir&gt;/&lt;id&gt;@&lt;version&gt;-&lt;hash&gt;.json</code>;</li>
<li>once that file is in place, <code>plugin-hostd-probe panel &lt;target&gt;</code>, whose stdout is the panel, filed under the same
name in <code>&lt;descriptor_dir&gt;/panels/</code>. Both are written once, atomically.</li>
</ol>
<p><code>panel</code> runs <code>omx-clap-scan --json</code> on the plugin's file (omx-clap-core 0.20.0 or later) and copies the <code>panel</code> object
the scan prints for the plugin's id, byte for byte. The daemon never reads the plugin's <code>decl.json</code> and never calls the
extension: what the scan printed is what a host gets. An add of a plugin whose descriptor is in place and whose panel
is not (a descriptor of an older daemon, a panel stage that failed) runs the panel stage alone.</p>
<h2 id="the-file">The file</h2>
<pre><code class="language-json">{&quot;plugin&quot;: {&quot;format&quot;: &quot;clap&quot;, &quot;id&quot;: &quot;org.openmixer.delay&quot;}, &quot;panel&quot;: {&quot;family&quot;: &quot;...&quot;, &quot;fingerprint&quot;: &quot;...&quot;,
 &quot;sections&quot;: [...], &quot;controls&quot;: [...], &quot;roles&quot;: [...], &quot;displays&quot;: [...], &quot;placementDefaults&quot;: [...]}}
</code></pre>
<ul>
<li><code>panel</code> is the scan's object as omx-clap-scan(1) states it: each entry with the members of its structure, a code by
omx-plugins' word for it, an id that is none as <code>null</code>, a visibility mask as a hex string.</li>
<li><code>panel</code> is <code>null</code> for a plugin that serves no description.</li>
<li>a table the scan refused for its count (past 4096 entries) stays refused: <code>{&quot;refused&quot;: &quot;too-many&quot;, &quot;count&quot;: &lt;n&gt;, &quot;max&quot;: 4096}</code> in place of its array, the other tables as they are.</li>
<li>an LV2 plugin's <code>panel</code> is <code>null</code>: the description is a CLAP extension, and nothing is run for it.</li>
<li>a scan that states no <code>panel</code> for the plugin (a scanner before omx-clap-scan 0.20.0, a plugin that fails to
initialise) is refused, and <code>panel_get</code> answers <code>-531</code>: a missing panel is never read as a null one.</li>
</ul>
<p>The field dump (<code>omx-clap-scan --fields</code>) prints the same description under its own scopes; the format table drops
each of those fields (docs/formats.md#what-a-table-drops), so the descriptor carries none of it.</p>
<h2 id="the-format-tables-stay-strict">The format tables stay strict</h2>
<p>A scan scope or field the format table has no row for is refused, and the add of that plugin answers <code>-531</code> for its
panel. A new scope or field of omx-clap-scan therefore needs its row in <code>data/formats/clap.json</code> first, with the rule
that says whether the descriptor carries it or drops it; a daemon is not to learn a scope by ignoring what it does not
know. Whether a refusal that costs one plugin its whole panel should rise to a single, higher-altitude refusal is a
design question of its own; until it is decided the tables stay strict.</p>
<h2 id="why-a-verb-of-its-own">Why a verb of its own</h2>
<p>The panel could have been a word more of <code>descriptor_get</code>'s reply, or a member of the descriptor. The protocol's own
conventions decide against both:</p>
<ul>
<li>Reply size. A message is at most <code>line_max</code>, 4096 bytes, the socket's buffer, and one panel table may hold 4096
entries. A panel never fits a reply, so it is a file the reply names, as the descriptor is.</li>
<li>No optional reply words. Every reply of the protocol is one fixed grammar, word by word (the protocol JSON's
<code>reply</code>); what is optional is a verb, answered or refused with <code>-902</code>, never a field a client must guess the
presence of. A second path in <code>descriptor_get</code>'s reply would change a <code>required</code> verb's grammar for every client
that parses it. A new verb leaves <code>descriptor_get</code> as it is, and a daemon that predates <code>panel_get</code> answers it
<code>-902</code>, which no client misreads.</li>
<li>The descriptor is omx-contract's document. A <code>scanned</code> descriptor follows <code>omx-contract.schema.json</code>, which has no
panel; the descriptor file stays what plugin-qualify and omx-contract's reader read.</li>
</ul>
<p>So <code>panel_get</code> is a daemon verb, required for every profile like <code>descriptor_get</code>, with its file beside the
descriptor's and the same codes.</p>
<h2 id="drawing-a-panel-the-three-verbs-together">Drawing a panel: the three verbs together</h2>
<p>A native renderer combines what the daemon serves; none of the three replaces another.</p>
<table>
<thead>
<tr>
<th>What</th>
<th>Verb</th>
<th>Keyed by</th>
</tr>
</thead>
<tbody>
<tr>
<td>the structure: sections, which control is in which, its widget, when it is shown, roles, displays</td>
<td><code>panel_get &lt;uri&gt;</code></td>
<td>the plugin's files</td>
</tr>
<tr>
<td>what a value means: unit, scale, range, default, step, the stable symbol</td>
<td><code>param_info &lt;instance&gt; &lt;symbol&gt;</code></td>
<td>the running instance</td>
</tr>
<tr>
<td>the pages of 8 a hardware surface steps through</td>
<td><code>remote_pages &lt;instance&gt;</code>, <code>remote_page_get &lt;instance&gt; &lt;page&gt;</code></td>
<td>the running instance</td>
</tr>
</tbody>
</table>
<ol>
<li>After <code>add &lt;uri&gt; &lt;instance&gt;</code>, ask <code>panel_get &lt;uri&gt;</code> until it is no <code>-530</code>. Only a <code>null</code> panel, and an LV2 plugin
until its bundle is read for a panel, mean the plugin states no layout: draw the
controls in parameter order, as a host did before. Every other code is a failure to show, not a plugin without a
layout: <code>-531</code> is a panel stage that failed and <code>-528</code> a descriptor directory that could not be written, and the
plugin may well have a layout. Name the failure to the user, and draw in parameter order only as the fallback.</li>
<li>For each control of <code>panel.controls</code> (in table order), its <code>paramId</code> is the CLAP parameter id, the number
<code>omx-clap-scan</code> lists a parameter by and the <code>&lt;symbol&gt;</code> the instance verbs take for a CLAP instance. The daemon does not parse that word:
<code>sup_instance_verb</code> (src/supervisor.c) passes the line of a format with native instance verbs, CLAP among them, to the
worker untouched, and omx-clap-host(1) states that it addresses a CLAP parameter by its decimal CLAP id.
<code>param_info &lt;instance&gt; &lt;paramId&gt;</code> gives its unit and scale,
so a knob shows <code>dB</code> and moves on its own scale; <code>-511</code> means the worker holds no checked contract, and the range
and default come from <code>omx-clap-scan</code>'s parameter list.</li>
<li>A control whose <code>visibleParamId</code> is not <code>null</code> is shown while bit <code>v</code> of <code>visibleMask</code> is set, <code>v</code> the value of that
parameter (<code>param_get</code>).</li>
<li><code>remote_page_get</code> gives the plugin's own grouping in eights, each slot a symbol: a surface with eight encoders
pages through those, the panel's sections and widgets dressing each slot.</li>
<li>A refused table is drawn as the plugin having none of it, and named to the user: its count is in the refusal.</li>
</ol>
<p>What the panel cannot give yet: an enum's labels and the remote pages in the scan itself;
until then a choice's labels come from the worker (<code>param_info</code> and the plugin's value texts) and the pages from
<code>remote_page_get</code>, both on a running instance.</p>
`},{slug:`placement`,src:`docs/placement.md`,title:`docs/placement.md`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/placement.md`,toc:[{id:`the-policy`,title:`The policy`},{id:`the-configuration`,title:`The configuration`},{id:`why-not-one-core-per-worker`,title:`Why not one core per worker`},{id:`which-core-is-reserved`,title:`Which core is reserved`},{id:`what-reports-the-core`,title:`What reports the core`},{id:`the-clap-thread-pool`,title:`The CLAP thread pool`},{id:`measured`,title:`Measured`}],html:`<h1 id="core-placement-the-workers-on-the-audio-cores-the-daemon-off-them">Core placement: the workers on the audio cores, the daemon off them</h1>
<p>plugin-hostd runs each chain (and each plugin that may not share) in a worker process of its own. On a small machine,
a Raspberry Pi 5 with four cores, the kernel and the JACK server decide where those processes run unless someone pins
them. A plugin's own threads do not help: Surge XT 1.4.0 and the other plugins measured on the Pi 5 ignore CLAP's
thread-pool extension, so one instrument is one audio thread. Several instruments use several cores only when each
runs in a worker of its own on cores the daemon, the UI and the system are kept off.</p>
<p>The setting <code>placement</code> does that.</p>
<h2 id="the-policy">The policy</h2>
<ul>
<li><strong>Audio cores.</strong> <code>audio_cores</code> is a cpu list (<code>1-3</code>, <code>2,3</code>). Empty, the default, is every cpu the daemon may run on
when it starts (its affinity, so a <code>taskset</code> or a cgroup is honoured) except one: the cpu of least capacity, the
lowest of a tie. A list that names a cpu outside that set refuses the start.</li>
<li><strong>The reserved cores</strong> are the daemon's cpus that are not audio cores: by default the one of least capacity
(below). The daemon pins itself and all its threads there at start. The processes it starts that are not workers,
the descriptor scans and probes, are forked from it and inherit that mask. The UI is the system's to pin there (<code>taskset -c &lt;cpu&gt;</code>, or
<code>CPUAffinity=&lt;cpu&gt;</code> in its unit; stderr names the cpu at start). With no reserved core left (<code>audio_cores</code> names
every cpu) the daemon is not pinned, and stderr says so.</li>
<li><strong>Each new worker</strong> is pinned (<code>sched_setaffinity</code>, in the child before it runs the worker program, so every thread
it creates, its JACK or PipeWire thread included, inherits the mask) to all the audio cores, never to one core of
them. The kernel then places the threads: workers that run side by side spread over the audio cores, and workers
linked in series stay where the last one woke them. A respawned worker, and one made anew (a chain formed, a group
split by a death, a quarantined member moved out), gets the same mask.</li>
<li><strong>Chains and isolated plugins.</strong> A chain, whether declared by <code>chain</code> or a segment of a <code>plan</code>, is one worker. A
plugin the planner leaves alone, an <code>isolated</code> verdict among them, gets a worker of its own, on the
audio cores as every other. Zynthian still sees one chain.</li>
<li><strong><code>worker_env</code>.</strong> A format whose workers were given a cpu list by <code>worker_env</code> keeps that list: the policy does not
move those workers, and they report no core.</li>
<li><strong><code>placement none</code></strong> pins nothing. Nothing is pinned, the workers inherit the daemon's mask,
and the reports say <code>-</code>.</li>
</ul>
<h2 id="the-configuration">The configuration</h2>
<p>In the settings file (<code>-c</code>, or <code>$XDG_CONFIG_HOME/plugin-hostd.conf</code>):</p>
<pre><code>placement spread        # or none
audio_cores 1-3         # empty: every cpu the daemon may use but the one of least capacity
</code></pre>
<p>and on the command line, over the file: <code>plugin-hostd --placement=none</code>.</p>
<h2 id="why-not-one-core-per-worker">Why not one core per worker</h2>
<p>The first <code>spread</code> pinned each new worker to one audio core of its own, the least loaded: by the sum of the
qualification costs of the workers on it, or by their count when a cost was unknown, so with no records the workers went
round the cores. That is what a series chain of workers cannot take. JACK wakes the clients of a chain one after the
other within each period; each worker on a core of its own is woken on a core that was idle, so every hop pays an
interrupt to another core and the exit from its idle state, and a 48-worker chain pays it 48 times a period.</p>
<p>The desk benchmark of plugin-hostd 0.16.0 (Intel Core Ultra 9 275HX, 24 cpus, governor performance, JACK2 at 96 kHz and
64 frames, 0.67 ms periods, three repeats; the <code>chains-vs-processes</code> scenarios, every plugin a worker of its own, linked
in series) measured it. Each row is the DSP load and xruns at 48 plugins with no other load, then with all cores kept
busy:</p>
<table>
<thead>
<tr>
<th>48 plugins in series</th>
<th>DSP, idle cores</th>
<th>xruns</th>
<th>DSP, busy cores</th>
<th>xruns</th>
</tr>
</thead>
<tbody>
<tr>
<td>plugin-hostd, one worker each, one core each (CLAP)</td>
<td>69.3 %</td>
<td>491</td>
<td>41.1 %</td>
<td>128</td>
</tr>
<tr>
<td>jalv, one process each, no pinning (LV2)</td>
<td>31.5 %</td>
<td>0</td>
<td>39.0 %</td>
<td>0</td>
</tr>
<tr>
<td>omx-clap-host, one process (CLAP)</td>
<td>25.3 %</td>
<td>0</td>
<td>39.4 %</td>
<td>0</td>
</tr>
<tr>
<td>plugin-hostd, one worker for the chain (CLAP)</td>
<td>13.6 %</td>
<td>0</td>
<td>15.2 %</td>
<td>0</td>
</tr>
</tbody>
</table>
<p>plugin-hostd and jalv ran the same number of processes, JACK clients and context switches (820 000 to 880 000 a run); the
difference is the pinning. It is about 5 µs a hop with idle cores and disappears when every core is kept busy, which is
what a wakeup on a cold core costs. Over every chain length the one-core-per-worker rule had 1100
xruns, 967 of them at 48 plugins, 110 at 32 and 16 at 24; jalv had 3. On a Pi 5 with three audio cores and 16 plugins
or fewer the hops were too few to show.</p>
<p>With the whole audio set the kernel may keep a series chain on the core that woke it, and still spreads workers that run
side by side. A chain declared as one worker is the cheapest of all and stays the way to run many plugins in series.</p>
<h2 id="which-core-is-reserved">Which core is reserved</h2>
<p>The daemon and the UI need little, so the core kept for them is the weakest one, and the audio keeps the strong ones.
The capacity of each cpu is read from <code>/sys/devices/system/cpu/cpu&lt;n&gt;/cpu_capacity</code>, which the kernel writes on hybrid
and big.LITTLE machines; where a cpu lacks it, from <code>cpufreq/cpuinfo_max_freq</code>; where both are missing, nothing is
known. The reserved core is the cpu of least capacity, the lowest of a tie, so a machine whose cpus are all alike (a
Raspberry Pi 5) keeps cpu 0 as before.</p>
<p>Reserving cpu 0 on a hybrid cpu takes a performance core from the audio. On the Intel Core Ultra 9 275HX of the desk
benchmark, cpus 0-7 are performance cores (<code>cpu_capacity</code> 1000) and 8-23 efficiency cores (765): with cpu 0 reserved,
48 workers had 7 performance cores where <code>placement none</code> gave them 8, and <code>none</code> had fewer xruns in three of four
cells at 96 kHz/64. Now the daemon sits on cpu 8 and the workers keep all eight performance cores.</p>
<h2 id="what-reports-the-core">What reports the core</h2>
<ul>
<li><code>worker_list</code>: each record is <code>&lt;worker&gt;:&lt;pid&gt;:&lt;format&gt;:&lt;state&gt;:&lt;core&gt;:&lt;pool&gt;:&lt;place&gt;:&lt;instances&gt;</code>. <code>&lt;core&gt;</code> is
always <code>-</code>: no worker is pinned to one core of its own. <code>&lt;pool&gt;</code> is <code>on</code> or <code>qualified</code> (below). The place still holds
colons, so a record is read from both ends: six fields on the left, the instances on the right.</li>
<li><code>plan</code> answers <code>resp 0 &lt;segments&gt; &lt;cores&gt;</code> and <code>plan_get</code> <code>resp 0 &lt;segments&gt; &lt;reasons&gt; &lt;cores&gt;</code>: <code>&lt;cores&gt;</code> has the
shape of <code>&lt;segments&gt;</code> with each member replaced by <code>-</code>, so <code>1,2;3</code> reads <code>-,-;-</code>.</li>
</ul>
<h2 id="the-clap-thread-pool">The CLAP thread pool</h2>
<p>omx-clap-host's pool of helper threads (<code>--thread-pool=qualified|off|on</code>, omx-clap-core#395) sizes itself from the
worker's affinity mask: N cores, N - 1 helpers. Under <code>spread</code> that mask is the audio cores, so a Pi 5 with three audio
cores gives a pool two helpers. The pool is the plugin's qualification's to give, never a global switch,
and it travels in the plugin's pin as the word <code>pool=cores</code> (or <code>pool=off</code>) after the verdict:</p>
<pre><code>pin_set &lt;uri&gt; &lt;files&gt; &lt;layout&gt; verdict=isolated pool=cores
</code></pre>
<p>A CLAP or lv2-clap worker of a plugin whose pin says <code>pool=cores</code> (and is not a refusal) is started with
<code>--thread-pool=on</code>, after the cpus above are set, so the mask it sizes the pool from is the one the policy gave it. The
plugin runs in a worker of its own: the planner leaves it alone (<code>verdict-isolated</code>), a <code>pool:</code> placement and a chain
are refused for it, and a respawn starts the worker with the option again. Every other worker is started with no
option, the host's <code>qualified</code>, which grants the pool to no plugin. The pool's waits past the block are in the worker's
<code>xruns</code> line, so they are attributed as any xrun is. Pins are read while <code>require_pins</code> is on, so the pool is too.</p>
<h2 id="measured">Measured</h2>
<p>On a Pi 5 (docs/evidence/placement-pi5-2026-10-29/): two and three LV2 instruments (Obxd, Monique) in
workers of their own, 60 s each, under the first <code>spread</code> (one core each). The workers sat on cores 1-3 and the daemon
on 0, and core 0 fell from 7-9 % busy to under 2 %; the sum over the cores was 2-3 points lower. Neither mode had an
xrun at that load: the instruments use a fraction of one core. Core 0 is the reserved core there still, since the Pi's
cores are all alike. The desk measurement of series chains is above, under Why not one core per worker.</p>
`},{slug:`presets`,src:`docs/presets.md`,title:`Presets in the host`,source:`https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/docs/presets.md`,toc:[{id:`who-owns-what`,title:`Who owns what`},{id:`verbs`,title:`Verbs`},{id:`the-file-org-openmixer-preset`,title:`The file: org.openmixer.preset`},{id:`loading-a-file`,title:`Loading a file`}],html:`<h1 id="presets-in-the-host">Presets in the host</h1>
<p>Presets in the host, as this tree builds it. The schema is
<a href="https://github.com/Open-Mixer/plugin-hostd/blob/a73969e2d024bab73a955c3f260154bdd241255f/protocol/preset.schema.json">protocol/preset.schema.json</a>; <code>tests/preset_format.py</code> holds it to the examples below.</p>
<h2 id="who-owns-what">Who owns what</h2>
<ul>
<li>The <strong>worker</strong> (omx-clap-host for CLAP, its LV2 adapter for LV2) holds the instance, so it owns the primitives: list
the plugin's own presets, load one, write the instance to a file, load a file.</li>
<li>The <strong>daemon</strong> relays the verbs to the worker that holds the instance and passes its answer back; it answers -902
only while the worker does. Before a file reaches a worker it reads it and refuses one that is not a preset file of
a version it knows (<code>PRESET_INVALID</code>), so no worker guesses at a format.</li>
<li>The <strong>consumer</strong> (the console, the Zynthian engine) owns the library: where files live, the user's presets, rename,
delete, banks. The host never decides a path or a name: both arrive as arguments.</li>
</ul>
<p>MIDI learn is policy of the surfaces: the host answers <code>midi_learn</code>, <code>midi_map</code>, <code>midi_unmap</code>, <code>cv_map</code> and <code>cv_unmap</code>
only as the mechanism, and the host verb table keeps them optional for every profile.</p>
<h2 id="verbs">Verbs</h2>
<table>
<thead>
<tr>
<th>verb</th>
<th>arguments</th>
<th>reply</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>preset_list</code></td>
<td><code>&lt;instance&gt;</code></td>
<td><code>resp &lt;count&gt;</code>, then <code>preset_get &lt;instance&gt; &lt;index&gt;</code> one row each</td>
</tr>
<tr>
<td><code>preset_load</code></td>
<td><code>&lt;instance&gt; &lt;stable name | file path&gt;</code></td>
<td><code>resp 0</code></td>
</tr>
<tr>
<td><code>preset_save</code></td>
<td><code>&lt;instance&gt; &lt;file path&gt; &lt;name&gt;</code></td>
<td><code>resp 0</code>: the worker wrote the file</td>
</tr>
<tr>
<td><code>preset_show</code></td>
<td><code>&lt;instance&gt; &lt;stable name | file path&gt;</code></td>
<td><code>resp 0 &lt;json&gt;</code>: what a load would apply, on one line of JSON (below)</td>
</tr>
</tbody>
</table>
<p>The reply of <code>preset_show</code> is <code>resp 0 &lt;json&gt;</code>, one shape on every worker and through the daemon, which passes the worker's
line on unchanged: the rest of the line after <code>resp 0 </code> is one JSON object on one line. For a file it is the document with
each state body's <code>bytes</code> replaced by its decoded <code>size</code>; for a listed preset (a stable name) it holds <code>name</code>, <code>loadKey</code>
and <code>location</code>. It is not <code>resp 0 &lt;carries&gt; &lt;name&gt;</code>: <code>carries</code> and <code>name</code> are fields of that object.</p>
<p>A file path is absolute (it starts with <code>/</code>); any other word is a stable name of the plugin's own presets, the
<code>load_key</code> of <code>preset_get</code>. The name of <code>preset_save</code> is the rest of the line, quoted when it holds a space.
<code>preset_show</code> has two forms, told apart by their number of words: <code>preset_show &lt;instance&gt; &lt;key&gt;</code> goes to the worker
that holds the instance alone, and <code>preset_show &lt;uri&gt;</code>, mod-host's form, goes to every worker and is answered as
mod-host answers it, by the LV2 worker: the preset's state, with no <code>resp</code> before it (the first answer of the workers
when no LV2 worker of mod-host's is up).
<code>bundle_add</code> and <code>bundle_remove</code> stay as declared.</p>
<h3 id="refusals">Refusals</h3>
<table>
<thead>
<tr>
<th>code</th>
<th>name</th>
<th>who</th>
<th>when</th>
</tr>
</thead>
<tbody>
<tr>
<td>-523</td>
<td><code>PRESET_NOT_OFFERED</code></td>
<td>worker</td>
<td>a stable name the plugin does not offer, or a plugin with no preset system and no state</td>
</tr>
<tr>
<td>-524</td>
<td><code>PRESET_INVALID</code></td>
<td>daemon, worker</td>
<td>a path that is not absolute, a <code>preset_save</code> with no name, a file that cannot be read, is no JSON, is of an unknown format version, or breaks the schema</td>
</tr>
<tr>
<td>-525</td>
<td><code>PRESET_NEEDS_STATE</code></td>
<td>worker</td>
<td>a file that carries state for a worker that cannot take state yet; it disappears when every worker takes state</td>
</tr>
<tr>
<td>-526</td>
<td><code>PRESET_PLUGIN_CHANGED</code></td>
<td>worker</td>
<td>the file's plugin id, version or fingerprint is not the instance's</td>
</tr>
<tr>
<td>-527</td>
<td><code>LOAD_REFUSED</code></td>
<td>worker</td>
<td>the plugin refused the state or the preset (its load callback failed)</td>
</tr>
</tbody>
</table>
<h2 id="the-file-org-openmixer-preset">The file: org.openmixer.preset</h2>
<p>The console's format, extended additively. <code>/1</code> stays valid and is params-only: our own plugins and their factory
presets never change. A file with a state body is <code>/2</code>.</p>
<table>
<thead>
<tr>
<th>field</th>
<th></th>
<th>meaning</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>format</code></td>
<td>required</td>
<td><code>org.openmixer.preset/1</code> or <code>org.openmixer.preset/2</code>; any other is refused, never guessed</td>
</tr>
<tr>
<td><code>plugin.id</code></td>
<td>required</td>
<td>the plugin's id: the CLAP id, or the LV2 uri</td>
</tr>
<tr>
<td><code>plugin.version</code></td>
<td>required in /2</td>
<td>the plugin's version as its descriptor says</td>
</tr>
<tr>
<td><code>plugin.fingerprint</code></td>
<td>required in /2</td>
<td>the descriptor fingerprint: the plugin's layout pin, <code>omx-layout/1:&lt;sha256&gt;</code>; a fingerprint of a scheme this version does not know is refused</td>
</tr>
<tr>
<td><code>id</code></td>
<td>required</td>
<td>stable, minted by the consumer; a worker writing a file names it after the file (its name without <code>.json</code>)</td>
</tr>
<tr>
<td><code>name</code></td>
<td>required</td>
<td>display, free text, editable on user presets only</td>
</tr>
<tr>
<td><code>alias</code></td>
<td>optional</td>
<td>a short label, at most 12 characters, for small displays (a scribble strip); absent means derive from <code>name</code></td>
</tr>
<tr>
<td><code>bank</code>, <code>tags</code>, <code>description</code></td>
<td>optional</td>
<td>the consumer's</td>
</tr>
<tr>
<td><code>createdAt</code>, <code>modifiedAt</code></td>
<td>optional</td>
<td>ISO 8601 UTC, <code>YYYY-MM-DDTHH:MM:SSZ</code></td>
</tr>
<tr>
<td><code>carries</code></td>
<td>required in /2</td>
<td><code>params</code>, <code>params+state</code> or <code>state</code></td>
</tr>
<tr>
<td><code>params</code></td>
<td></td>
<td><code>[{symbol, unit, value}]</code>: plain values, written as the plugin gave them, never a float widened</td>
</tr>
<tr>
<td><code>state</code></td>
<td></td>
<td><code>{encoding: &quot;base64&quot;, context, bytes, files?}</code>; <code>context</code> is <code>preset</code> or <code>project</code> for CLAP (the clap.state context), <code>lv2</code> for LV2; <code>files</code> <code>[{name, encoding, bytes}]</code> are LV2 state paths, a file name each</td>
</tr>
</tbody>
</table>
<p>The writer picks <code>carries</code>: <code>params</code> when the plugin has only declared parameters, otherwise <code>state</code> (<code>params+state</code>
when both are read). <code>carries</code> and the body agree: <code>params</code> has <code>params</code> and no <code>state</code>, <code>params+state</code> both, <code>state</code>
a <code>state</code>. Unknown fields are kept on rewrite.</p>
<p>A params-only file of /2:</p>
<pre><code class="language-json">{&quot;format&quot;: &quot;org.openmixer.preset/2&quot;,
 &quot;plugin&quot;: {&quot;id&quot;: &quot;org.freemixer.comp&quot;, &quot;version&quot;: &quot;1.2.0&quot;,
            &quot;fingerprint&quot;: &quot;omx-layout/1:0000000000000000000000000000000000000000000000000000000000000000&quot;},
 &quot;id&quot;: &quot;warm&quot;, &quot;name&quot;: &quot;Warm Pad&quot;, &quot;createdAt&quot;: &quot;2026-10-22T21:00:00Z&quot;, &quot;modifiedAt&quot;: &quot;2026-10-22T21:00:00Z&quot;,
 &quot;carries&quot;: &quot;params&quot;, &quot;params&quot;: [{&quot;symbol&quot;: &quot;gain&quot;, &quot;unit&quot;: &quot;dB&quot;, &quot;value&quot;: -3.25}]}
</code></pre>
<p>A state file adds <code>&quot;carries&quot;: &quot;params+state&quot;</code> and
<code>&quot;state&quot;: {&quot;encoding&quot;: &quot;base64&quot;, &quot;context&quot;: &quot;preset&quot;, &quot;bytes&quot;: &quot;AAEC&quot;}</code>.</p>
<h2 id="loading-a-file">Loading a file</h2>
<ol>
<li>The daemon reads the file and checks it against the format above (<code>PRESET_INVALID</code> when it does not hold); no
worker is asked.</li>
<li>The worker compares <code>plugin</code> with the instance: another id, version or fingerprint answers <code>PRESET_PLUGIN_CHANGED</code>
and nothing is applied.</li>
<li>The worker applies the state body when the file carries one, then the parameter values, each clamped to its
declared range, an unknown symbol ignored, as clap.state's load does.</li>
</ol>
<p>Parameter feedback (the <code>param_set</code> event a worker writes for a value the plugin moved by itself, a preset load
included) is the declared event of the protocol's JSON (plugin-hostd-protocol's <code>plugin-hostd.json</code>); a controller's own writes produce none.</p>
`}],r={repo:e,commit:t,pages:n};export{t as commit,r as default,n as pages,e as repo};