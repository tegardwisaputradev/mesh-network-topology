let nodes = [];
let brokenLinks = new Set();
let selectedNode = null;
let isDragging = false;
let activeNodeId = 6;
let isAutoSimActive = false;
let autoSimInterval = null;
let dynamicEventInterval = null;
let dynamicNodeInterval = null;
let activePackets = [];

const canvas = document.getElementById('canvasContainer');
const svg = document.getElementById('svgCanvas');
const logBox = document.getElementById('logBox');

function log(message) {
    logBox.innerHTML += `> ${message}<br>`;
    logBox.scrollTop = logBox.scrollHeight;
}

function clearLogs() {
    const logBox = document.getElementById('logBox');
    logBox.innerHTML = "";
}

function updateSpeedLabel(val) {
    document.getElementById('speedLabel').innerText = `${val} ms`;
}

function updateFreqLabel(val) {
    document.getElementById('freqLabel').innerText = `${val} ms`;
    if (isAutoSimActive && autoSimInterval) {
        clearInterval(autoSimInterval);
        startAutoTrafficInterval();
    }
}

function addNodeManual() {
    const input = document.getElementById('nodeNameInput');
    let name = input.value.trim() || `PC ${activeNodeId}`;
    
    const rect = canvas.getBoundingClientRect();
    const x = 100 + Math.random() * (rect.width - 200);
    const y = 100 + Math.random() * (rect.height - 200);

    createNode(name, x, y);
    activeNodeId++;
    input.value = `PC ${activeNodeId}`;
}

function createNode(name, x, y) {
    const id = 'node_' + Date.now() + Math.floor(Math.random() * 1000);
    const nodeObj = { id, name, x, y };
    nodes.push(nodeObj);

    const el = document.createElement('div');
    el.className = 'node';
    el.id = id;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.innerHTML = `💻<span>${name}</span>`;
    
    el.addEventListener('mousedown', (e) => {
        isDragging = true;
        selectedNode = nodeObj;
        e.stopPropagation();
    });

    canvas.appendChild(el);
    updateMeshConnections();
    updateDropdowns();
    log(`Perangkat [${name}] ditambahkan ke jaringan.`);
}

function removeNodeAutomatic(nodeId) {
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const removedNode = nodes[nodeIndex];
    nodes.splice(nodeIndex, 1);

    const el = document.getElementById(nodeId);
    if (el) el.remove();

    for (let linkKey of brokenLinks) {
        if (linkKey.includes(nodeId)) {
            brokenLinks.delete(linkKey);
        }
    }

    updateMeshConnections();
    updateDropdowns();
    log(`Perangkat [${removedNode.name}] offline / terputus otomatis.`);
}

window.addEventListener('mousemove', (e) => {
    if (!isDragging || !selectedNode) return;
    const rect = canvas.getBoundingClientRect();
    let newX = Math.max(30, Math.min(rect.width - 30, e.clientX - rect.left));
    let newY = Math.max(30, Math.min(rect.height - 30, e.clientY - rect.top));

    selectedNode.x = newX;
    selectedNode.y = newY;

    const el = document.getElementById(selectedNode.id);
    if (el) {
        el.style.left = newX + 'px';
        el.style.top = newY + 'px';
    }
    updateMeshConnections();
});

window.addEventListener('mouseup', () => { isDragging = false; });

function getLinkKey(id1, id2) {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
}

function checkNodeIsolation(nodeId) {
    let connectedCount = 0;
    let activeConnectionCount = 0;

    for (let other of nodes) {
        if (other.id === nodeId) continue;
        connectedCount++;
        let linkKey = getLinkKey(nodeId, other.id);
        if (!brokenLinks.has(linkKey)) {
            activeConnectionCount++;
        }
    }

    if (connectedCount === 0) return 'normal';
    if (activeConnectionCount === 0) return 'isolated'; // putus total Merah
    if (activeConnectionCount < connectedCount) return 'warning'; // masih ada jalur lain Oranye
    return 'normal';
}

function updateMeshConnections() {
    svg.innerHTML = '';
    
    nodes.forEach(n => {
        const el = document.getElementById(n.id);
        if (el) {
            el.classList.remove('link-damaged', 'link-warning');
            let status = checkNodeIsolation(n.id);
            if (status === 'isolated') {
                el.classList.add('link-damaged'); // Merah 
            } else if (status === 'warning') {
                el.classList.add('link-warning'); // Oranye
            }
        }
    });

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            const linkKey = getLinkKey(n1.id, n2.id);
            const isBroken = brokenLinks.has(linkKey);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', n1.x);
            line.setAttribute('y1', n1.y);
            line.setAttribute('x2', n2.x);
            line.setAttribute('y2', n2.y);
            
            if (isBroken) {
                line.setAttribute('stroke', '#dc2626');
                line.setAttribute('stroke-width', '3.5');
                line.setAttribute('stroke-dasharray', '3,6');
            } else {
                line.setAttribute('stroke', '#475569');
                line.setAttribute('stroke-width', '3');
                line.setAttribute('stroke-dasharray', '6,4');
            }
            svg.appendChild(line);
        }
    }
    updateLinkDropdown();
}

function updateDropdowns() {
    const sourceSelect = document.getElementById('sourceSelect');
    const destSelect = document.getElementById('destSelect');
    sourceSelect.innerHTML = '';
    destSelect.innerHTML = '';

    nodes.forEach(n => {
        sourceSelect.innerHTML += `<option value="${n.id}">${n.name}</option>`;
        destSelect.innerHTML += `<option value="${n.id}">${n.name}</option>`;
    });
    if (nodes.length > 1) destSelect.selectedIndex = 1;
}

function updateLinkDropdown() {
    const linkSelect = document.getElementById('linkSelect');
    linkSelect.innerHTML = '';

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const n1 = nodes[i];
            const n2 = nodes[j];
            const linkKey = getLinkKey(n1.id, n2.id);
            const status = brokenLinks.has(linkKey) ? '[Terputus]' : '[Normal]';
            linkSelect.innerHTML += `<option value="${linkKey}">${n1.name} <-> ${n2.name} ${status}</option>`;
        }
    }
}

function toggleLinkBreak() {
    const linkKey = document.getElementById('linkSelect').value;
    if (!linkKey) return;

    if (brokenLinks.has(linkKey)) {
        brokenLinks.delete(linkKey);
        log(`Kabel penghubung berhasil disambungkan kembali.`);
    } else {
        brokenLinks.add(linkKey);
        log(`Kabel penghubung diputus secara manual.`);
    }
    updateMeshConnections();
}

function randomizeBrokenLinks() {
    brokenLinks.clear();
    let allPossibleLinks = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            allPossibleLinks.push(getLinkKey(nodes[i].id, nodes[j].id));
        }
    }

    allPossibleLinks.forEach(linkKey => {
        if (Math.random() < 0.25) {
            brokenLinks.add(linkKey);
        }
    });

    log(`Acak jalur aktif: ${brokenLinks.size} kabel diputus secara random.`);
    updateMeshConnections();
}

function resetAllLinks() {
    brokenLinks.clear();
    updateMeshConnections();
    log(`Semua jalur kabel dipulihkan ke kondisi normal.`);
}

function resetAllNodes() {
    if (isAutoSimActive) toggleAutoSimulation();
    nodes = [];
    brokenLinks.clear();
    activePackets = [];
    svg.innerHTML = '';
    canvas.querySelectorAll('.node').forEach(el => el.remove());
    activeNodeId = 1;
    document.getElementById('nodeNameInput').value = `PC 1`;
    updateDropdowns();
    log('Semua perangkat PC dihapus dari sistem.');
}

function findPath(startId, targetId) {
    let queue = [[startId]];
    let visited = new Set([startId]);

    while (queue.length > 0) {
        let path = queue.shift();
        let currId = path[path.length - 1];

        if (currId === targetId) return path;

        for (let other of nodes) {
            if (other.id === currId) continue;
            let linkKey = getLinkKey(currId, other.id);

            if (!brokenLinks.has(linkKey) && !visited.has(other.id)) {
                visited.add(other.id);
                let newPath = [...path, other.id];
                queue.push(newPath);
            }
        }
    }
    return null;
}

function getRandomColor() {
    const colors = ['#f43f5e', '#38bdf8', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function simulateSmartRouting(customSourceId = null, customDestId = null, isRetransmit = false) {
    const sourceId = customSourceId || document.getElementById('sourceSelect').value;
    const destId = customDestId || document.getElementById('destSelect').value;

    if (nodes.length < 2) return;
    if (sourceId === destId) return;

    const pathIds = findPath(sourceId, destId);
    const sourceNode = nodes.find(n => n.id === sourceId);
    const destNode = nodes.find(n => n.id === destId);

    if (!pathIds || !sourceNode || !destNode) {
        if (!customSourceId) log(`Pengiriman gagal: Jaringan terputus dari [${sourceNode.name}] ke [${destNode.name}].`);
        return;
    }

    const srcElement = document.getElementById(sourceId);
    if (srcElement) {
        let flashClass = isRetransmit ? 'retransmitting' : 'sending';
        srcElement.classList.add(flashClass);
        setTimeout(() => srcElement.classList.remove(flashClass), 500);
    }

    let pathNodes = pathIds.map(id => nodes.find(n => n.id === id));
    let pathNames = pathNodes.map(n => n.name).join(' -> ');
    let packetColor = getRandomColor();

    if (!customSourceId && !isRetransmit) {
        if (pathNodes.length === 2) {
            log(`Paket terkirim via jalur langsung: [${pathNames}]`);
        } else {
            log(`Jalur utama terhalang. Rute dialihkan: [${pathNames}]`);
        }
    }

    animateStepByStep(pathNodes, 0, packetColor, sourceId, destId);
}

function animateStepByStep(pathNodes, stepIndex, color, sourceId, destId) {
    if (stepIndex >= pathNodes.length - 1) return;

    let fromNode = pathNodes[stepIndex];
    let toNode = pathNodes[stepIndex + 1];

    const packet = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    packet.setAttribute('r', '7');
    packet.setAttribute('fill', color);
    packet.style.filter = `drop-shadow(0 0 6px ${color})`;
    svg.appendChild(packet);

    let baseDuration = parseInt(document.getElementById('speedSlider').value);
    let startTime = null;

    let packetData = {
        element: packet,
        x: fromNode.x,
        y: fromNode.y,
        active: true,
        sourceId: sourceId,
        destId: destId
    };
    activePackets.push(packetData);

    function stepAnim(timestamp) {
        if (!packetData.active) return;
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / baseDuration;
        if (progress > 1) progress = 1;

        let cx = fromNode.x + (toNode.x - fromNode.x) * progress;
        let cy = fromNode.y + (toNode.y - fromNode.y) * progress;

        packetData.x = cx;
        packetData.y = cy;
        packet.setAttribute('cx', cx);
        packet.setAttribute('cy', cy);

        if (progress > 0.15 && progress < 0.85) {
            for (let other of activePackets) {
                if (other !== packetData && other.active) {
                    let dist = Math.hypot(cx - other.x, cy - other.y);
                    if (dist < 14) { 
                        packetData.active = false;
                        other.active = false;
                        
                        if (svg.contains(packet)) svg.removeChild(packet);
                        if (svg.contains(other.element)) svg.removeChild(other.element);
                        
                        triggerCollisionAndRetransmit(cx, cy, packetData.sourceId, packetData.destId, other.sourceId, other.destId);
                        return;
                    }
                }
            }
        }

        if (progress < 1) {
            requestAnimationFrame(stepAnim);
        } else {
            if (svg.contains(packet)) svg.removeChild(packet);
            activePackets = activePackets.filter(p => p !== packetData);
            
            if (stepIndex === pathNodes.length - 2) {
                let finalDest = pathNodes[pathNodes.length - 1];
                log(`Paket sukses diterima di [${finalDest.name}].`);

                const dstElement = document.getElementById(finalDest.id);
                if (dstElement) {
                    dstElement.classList.add('receiving');
                    setTimeout(() => dstElement.classList.remove('receiving'), 600);
                }
            } else {
                animateStepByStep(pathNodes, stepIndex + 1, color, sourceId, destId);
            }
        }
    }

    requestAnimationFrame(stepAnim);
}
function findAlternativePath(startId, targetId, avoidIntermediateIds = []) {
    let queue = [[startId]];
    let visited = new Set([startId]);

    while (queue.length > 0) {
        let path = queue.shift();
        let currId = path[path.length - 1];

        if (currId === targetId) return path;

        for (let other of nodes) {
            if (other.id === currId) continue;
            let linkKey = getLinkKey(currId, other.id);

            if (avoidIntermediateIds.includes(other.id) && other.id !== targetId) continue;

            if (!brokenLinks.has(linkKey) && !visited.has(other.id)) {
                visited.add(other.id);
                let newPath = [...path, other.id];
                queue.push(newPath);
            }
        }
    }
    
    return findPath(startId, targetId);
}

function triggerCollisionAndRetransmit(x, y, src1Id, dst1Id, src2Id, dst2Id) {
    let src1Node = nodes.find(n => n.id === src1Id);
    let src2Node = nodes.find(n => n.id === src2Id);

    let name1 = src1Node ? src1Node.name : "PC";
    let name2 = src2Node ? src2Node.name : "PC";

    log(`Tabrakan terdeteksi! Paket [${name1}] & [${name2}] Korup. Menghindari Node Konflik...`);

    [src1Id, src2Id].forEach(id => {
        let el = document.getElementById(id);
        if (el) {
            el.classList.add('colliding');
            setTimeout(() => el.classList.remove('colliding'), 700);
        }
    });

    let text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', x);
    text.setAttribute('y', y - 10);
    text.setAttribute('fill', '#ef4444');
    text.setAttribute('font-size', '10px');
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('text-anchor', 'middle');
    text.textContent = 'CORRUPT & DROP';
    svg.appendChild(text);

    setTimeout(() => {
        if (svg.contains(text)) svg.removeChild(text);
    }, 1000);

    let delay1 = 500 + Math.random() * 400;
    let delay2 = 1800 + Math.random() * 800;

    setTimeout(() => {
        log(`[Rute Alternatif] Transmisi ulang dari [${name1}]...`);
        
        const altPathIds = findAlternativePath(src1Id, dst1Id, [src2Id, dst2Id]);
        if (altPathIds && altPathIds.length > 1) {
            let pathNodes = altPathIds.map(id => nodes.find(n => n.id === id));
            let pathNames = pathNodes.map(n => n.name).join(' -> ');
            log(`[Multipath] Paket [${name1}] dialihkan lewat rute: [${pathNames}]`);
            animateStepByStep(pathNodes, 0, getRandomColor(), src1Id, dst1Id);
        } else {
            simulateSmartRouting(src1Id, dst1Id, true);
        }
    }, delay1);

    // Transmisi ulang PC 2
    setTimeout(() => {
        log(`[Rute Alternatif] Transmisi ulang dari [${name2}] (Selesai Antre)...`);
        
        const altPathIds = findAlternativePath(src2Id, dst2Id, [src1Id, dst1Id]);
        if (altPathIds && altPathIds.length > 1) {
            let pathNodes = altPathIds.map(id => nodes.find(n => n.id === id));
            let pathNames = pathNodes.map(n => n.name).join(' -> ');
            log(`[Multipath] Paket [${name2}] dialihkan lewat rute: [${pathNames}]`);
            animateStepByStep(pathNodes, 0, getRandomColor(), src2Id, dst2Id);
        } else {
            simulateSmartRouting(src2Id, dst2Id, true);
        }
    }, delay2);
}

function startAutoTrafficInterval() {
    let freqVal = parseInt(document.getElementById('freqSlider').value);
    autoSimInterval = setInterval(() => {
        if (nodes.length < 2) return;
        let srcIdx = Math.floor(Math.random() * nodes.length);
        let destIdx;
        do {
            destIdx = Math.floor(Math.random() * nodes.length);
        } while (destIdx === srcIdx);

        simulateSmartRouting(nodes[srcIdx].id, nodes[destIdx].id);
    }, freqVal);
}

function toggleAutoSimulation() {
    isAutoSimActive = !isAutoSimActive;
    const statusBadge = document.getElementById('modeStatus');
    const toggleBtn = document.getElementById('toggleSimBtn');
    const manualControls = document.getElementById('manualControls');

    if (isAutoSimActive) {
        statusBadge.className = 'status-badge status-auto';
        statusBadge.innerText = 'Mode: Simulasi Live';
        toggleBtn.className = 'btn-danger';
        toggleBtn.innerText = 'Hentikan Simulasi Live';
        manualControls.style.opacity = '0.4';
        manualControls.style.pointerEvents = 'none';
        log(`Simulasi live diaktifkan.`);

        startAutoTrafficInterval();

        dynamicEventInterval = setInterval(() => {
            const isGangguanChecked = document.getElementById('checkGangguanJalur').checked;
            if (!isGangguanChecked) return;

            let allLinks = [];
            for (let i = 0; i < nodes.length; i++) {
                for (let j = i + 1; j < nodes.length; j++) {
                    allLinks.push(getLinkKey(nodes[i].id, nodes[j].id));
                }
            }
            if (allLinks.length === 0) return;

            let randomLink = allLinks[Math.floor(Math.random() * allLinks.length)];
            if (brokenLinks.has(randomLink)) {
                brokenLinks.delete(randomLink);
                log(`Sistem pulih otomatis: Kabel terhubung kembali.`);
            } else {
                brokenLinks.add(randomLink);
                log(`Gangguan otomatis: Sebagian kabel terputus.`);
            }
            updateMeshConnections();
        }, 5000);

        dynamicNodeInterval = setInterval(() => {
            const isDinamisPCChecked = document.getElementById('checkDinamisPC').checked;
            if (!isDinamisPCChecked) return;

            let actionRand = Math.random();
            
            if (actionRand < 0.4 && nodes.length > 3) {
                let victimNode = nodes[Math.floor(Math.random() * nodes.length)];
                removeNodeAutomatic(victimNode.id);
            } else if (actionRand >= 0.4 && actionRand < 0.75) {
                let newName = `PC ${activeNodeId}`;
                const rect = canvas.getBoundingClientRect();
                let x = 100 + Math.random() * (rect.width - 200);
                let y = 100 + Math.random() * (rect.height - 200);
                createNode(newName, x, y);
                activeNodeId++;
            }
        }, 8000);

    } else {
        statusBadge.className = 'status-badge status-manual';
        statusBadge.innerText = 'Mode: Manual';
        toggleBtn.className = 'btn-success';
        toggleBtn.innerText = 'Mulai Simulasi Live';
        manualControls.style.opacity = '1';
        manualControls.style.pointerEvents = 'auto';
        log(`Simulasi Live dihentikan.`);

        clearInterval(autoSimInterval);
        clearInterval(dynamicEventInterval);
        clearInterval(dynamicNodeInterval);
    }
}

function initDefaultNodes() {
    createNode("PC 1", 120, 160);
    createNode("PC 2", 320, 90);
    createNode("PC 3", 520, 160);
    createNode("PC 4", 220, 360);
    createNode("PC 5", 420, 360);
}

window.onload = () => {
    initDefaultNodes();
    clearLogs();
};