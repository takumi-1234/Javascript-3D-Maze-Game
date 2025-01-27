const BUTTON_HIGHLIGHT_COLOR = "rgba(200, 200, 200, 0.6)";
const BUTTON_ACTIVE_COLOR = "rgba(100, 100, 100, 0.8)";
const MOVE_DISTANCE = 50;
const MOVE_SPEED = 50;
const CAMERA_OFFSET = new THREE.Vector3(0, 40, -70);
const JUMP_SPEED = 0.5;
const JUMP_HEIGHT = 10;
const LEG_SWING_SPEED = 0.4;
const MAP_SIZE = 65;
const BLOCK_SIZE = 512;
const TIME_LIMIT = 240;
const INITIAL_HP = 300;
const MAX_HP = 400;
const ENEMY_DAMAGE = 10;
const PLAYER_DAMAGE = 30;
const MIN_ROOM_SIZE = 6;
const MAX_ROOM_SIZE = 10;
const MIN_SPACE_BETWEEN_ROOM_AND_ROAD = 3;
const CAMERA_LERP_SPEED = 0.6;
const INITIAL_CAMERA_LERP_SPEED = 0.006;
const ROTATE_SPEED = Math.PI / 12;
let isRotatingLeft = false;
let isRotatingRight = false;
let isRotating = false;
const ITEM_COLLISION_RADIUS_MULTIPLIER = BLOCK_SIZE;  
const ITEM_RADIUS_MULTIPLIER = 3;
const ENEMY_COLLISION_RADIUS_MULTIPLIER = 4;   // 2倍
const ENEMY_DAMAGE_INTERVAL = 5000;
const ROBOT_ROTATE_SPEED = 0.1;
const ENEMY_MOVE_SPEED_MULTIPLIER = 0.001;
const ENEMY_VIEW_RANGE = 10 * BLOCK_SIZE; // 2倍
const ENEMY_STOP_DISTANCE = BLOCK_SIZE * 2;// 2倍
const ATTACK_RANGE = 2; // 攻撃範囲を2ブロックに変更

let robotGroup;
let floorGroup;
let mapData;
let exploredMap;
let robotPosition;
let minimapCanvas;
let minimapCtx;
let timeRemaining;
let timerInterval;
let playerHP = INITIAL_HP;
let items = {
    "wallBreaker": {
        count: 0,
        durability: 10
    }
};
let currentItem = "wallBreaker";
let enemies = [];
let enemyPositions = [];
let enemyHP = {};
let areaList = [];
let renderer, scene, camera;
let itemPositions = [];
let world;
let goalX, goalZ;
let lastEnemyDamageTime = 0;
let cameraLerpSpeed = INITIAL_CAMERA_LERP_SPEED;
let initialCameraMove = true;
let cameraRotationOn = false;

let cameraTransitioning = false;
let targetCameraDirection = new THREE.Vector3();
const CAMERA_ROTATE_LERP_SPEED = 0.05;

window.addEventListener("DOMContentLoaded", () => {
    init();
});

function init() {
    console.log("init start");

    let isMoving = false;
    let isJumping = false;
    let jumpHeight = 0;
    let jumpDirection = 1;
    let targetPosition = new THREE.Vector3();
    let currentDirection = new THREE.Vector3(0, 0, 1);

    timeRemaining = TIME_LIMIT;
    updateTimerDisplay();
    startTimer();

    const width = window.innerWidth;
    const height = window.innerHeight;

    renderer = new THREE.WebGLRenderer({
        canvas: document.querySelector("#myCanvas")
    });
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000);

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(120, width / height, 1, 2000);
    camera.position.set(0, 15000, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const createShaderMaterial = (vertexShader, fragmentShader) => {
        return new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader
        });
    };

    const armMaterial = createShaderMaterial(
        `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        `
            varying vec3 vPosition;
            void main() {
                if (vPosition.y > 5.0) {
                    gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
                } else {
                    gl_FragColor = vec4(0.98, 0.82, 0.18, 1.0);
                }
            }
        `
    );
    const legMaterial = createShaderMaterial(
        `
            varying vec3 vPosition;
            void main() {
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        `
            varying vec3 vPosition;
            void main() {
                if (vPosition.y > -4.0) {
                    gl_FragColor = vec4(0.5, 0.0, 0.5, 1.0);
                } else {
                    gl_FragColor = vec4(0.67, 0.67, 0.67, 1.0);
                }
            }
        `
    );

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00FFFF, roughness: 0.9, metalness: 0.1 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xEAC28B, roughness: 0.8, metalness: 0.2 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.7, metalness: 0.5 });
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.9, metalness: 0.2 });
    const earMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.7, metalness: 0.3 });

    robotGroup = new THREE.Group();
    const headGroup = new THREE.Group();

    const head = new THREE.Mesh(new THREE.BoxGeometry(20, 16, 16), headMat);
    head.position.set(0, 10, 0);
    headGroup.add(head);

    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), eyeMat);
    eye1.position.set(5, 13, -8);
    headGroup.add(eye1);

    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), eyeMat);
    eye2.position.set(-5, 13, -8);
    headGroup.add(eye2);

    const mouth = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 3), mouthMat);
    mouth.position.set(0, 7, -8);
    mouth.rotation.set(Math.PI / 2, Math.PI, 0);
    headGroup.add(mouth);

    const earGeometry = new THREE.CylinderGeometry(0, 4, 6, 3);
    const ear1 = new THREE.Mesh(earGeometry, earMat);
    ear1.position.set(6, 18, 0);
    ear1.rotation.set(Math.PI / 2, Math.PI / 3, 0);
    headGroup.add(ear1);

    const ear2 = new THREE.Mesh(earGeometry, earMat);
    ear2.position.set(-6, 18, 0);
    ear2.rotation.set(Math.PI / 2, -Math.PI / 3, 0);
    headGroup.add(ear2);

    robotGroup.add(headGroup);

    const body = new THREE.Mesh(new THREE.BoxGeometry(15, 20, 10), bodyMat);
    body.position.set(0, -8, 0);
    robotGroup.add(body);

    const armGeometry = new THREE.BoxGeometry(6, 20, 6);

    const arm1 = new THREE.Mesh(armGeometry, armMaterial);
    arm1.position.set(12, -8, 0);
    arm1.rotation.x = Math.PI / 6;
    robotGroup.add(arm1);

    const arm2 = new THREE.Mesh(armGeometry, armMaterial);
    arm2.position.set(-12, -8, 0);
    arm2.rotation.x = -Math.PI / 6;
    robotGroup.add(arm2);

    const torchGeometry = new THREE.CylinderGeometry(2, 1, 8, 12);
    const torchMaterial = new THREE.MeshStandardMaterial({ color: 0xffa500, emissive: 0xffa500, emissiveIntensity: 1 });
    const torch = new THREE.Mesh(torchGeometry, torchMaterial);
    torch.position.set(0, -8, 0);
    torch.rotation.x = Math.PI / 2;

    const torchGroup = new THREE.Group();
    torchGroup.add(torch);
    arm2.add(torchGroup);

    const spotLight = new THREE.SpotLight(0xffffff, 1, 200, Math.PI / 6, 0, 0.5);
    spotLight.target = torch;
    spotLight.position.set(0, 0, 0);
    spotLight.angle = Math.PI;
    spotLight.penumbra = 0.3;
    torchGroup.add(spotLight);

    const legGeometry = new THREE.BoxGeometry(6, 15, 10);
    const leg1 = new THREE.Mesh(legGeometry, legMaterial);
    leg1.position.set(4, -26, 0);
    leg1.name = "rightLeg";
    robotGroup.add(leg1);

    const leg2 = new THREE.Mesh(legGeometry, legMaterial);
    leg2.position.set(-4, -26, 0);
    leg2.name = "leftLeg";
    robotGroup.add(leg2);

    scene.add(robotGroup);
    robotGroup.position.y = BLOCK_SIZE / 2 - 220;
    const leftLeg = robotGroup.getObjectByName("leftLeg");
    const rightLeg = robotGroup.getObjectByName("rightLeg");

    mapData = generateMaze();
    exploredMap = initializeExploredMap(MAP_SIZE);
    floorGroup = createMazeFloor(mapData, BLOCK_SIZE);
    scene.add(floorGroup);

    world = new World(MAP_SIZE * BLOCK_SIZE, MAP_SIZE * BLOCK_SIZE);

    const robotActor = new ThreeJSActor(robotGroup, "player");
    setInitialRobotPosition();
    robotGroup.position.copy(robotPosition);
    targetPosition.copy(robotPosition);
    world.addActor(robotActor);

    placeItemsAndEnemies(scene, world);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    minimapCanvas = document.getElementById('minimap');
    minimapCtx = minimapCanvas.getContext('2d');
    minimapCanvas.width = MAP_SIZE;
    minimapCanvas.height = MAP_SIZE;
    updateMinimap();

    const statusDisplay = document.getElementById('status-display');
    updateStatusDisplay(statusDisplay);

    const buttons = {
        up: document.getElementById("up"),
        down: document.getElementById("down"),
        left: document.getElementById("left"),
        right: document.getElementById("right"),
        attack: document.getElementById("attack")
    };

    const defaultButtonColors = {};
    for (const key in buttons) {
        defaultButtonColors[key] = getComputedStyle(buttons[key]).backgroundColor;
    }

    for (const key in buttons) {
        const button = buttons[key];

        button.addEventListener("mouseenter", () => {
            button.style.backgroundColor = BUTTON_HIGHLIGHT_COLOR;
        });

        button.addEventListener("mouseleave", () => {
            button.style.backgroundColor = defaultButtonColors[key];
        });

        button.addEventListener("mousedown", () => {
            button.style.backgroundColor = BUTTON_ACTIVE_COLOR;
        });

        button.addEventListener("mouseup", () => {
            setTimeout(() => {
                button.style.backgroundColor = BUTTON_HIGHLIGHT_COLOR;
            }, 100);
        });

        button.addEventListener("click", () => {
            if (key === "attack") {
                attackEnemy(scene, world);
            } else {
                moveRobot(key, targetPosition);
            }
        });
    }
    document.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "w":
                moveRobot("up", targetPosition);
                break;
            case "a":
                moveRobot("left", targetPosition);
                break;
            case "s":
                moveRobot("down", targetPosition);
                break;
            case "d":
                moveRobot("right", targetPosition);
                break;
            case "j":
                if (!isJumping) {
                    isJumping = true;
                }
                break;
             case "q":
                  isRotatingLeft = true;
                    robotGroup.rotation.y += ROTATE_SPEED;
                    updateCamera();
                break;
            case "e":
                   isRotatingRight = true;
                   robotGroup.rotation.y -= ROTATE_SPEED;
                   updateCamera();
                break;
             case "z":
                  attackEnemy(scene, world);
                break;
        }
    });
    document.addEventListener("keyup", (event) => {
          switch (event.key) {
           case "q":
               isRotatingLeft = false;
                break;
           case "e":
                isRotatingRight = false;
               break;
         }
    });
    const rotateButtons = document.querySelectorAll(".rotate-button");
    rotateButtons.forEach(button => {
        button.addEventListener("mousedown", (event) => {
            const direction = event.target.getAttribute("data-direction");
            if (direction === "left") {
                isRotatingLeft = true;
                robotGroup.rotation.y += ROTATE_SPEED;
                updateCamera();
            } else if (direction === "right") {
                isRotatingRight = true;
                robotGroup.rotation.y -= ROTATE_SPEED;
                updateCamera();
            }
            isRotating = true;
        });

        button.addEventListener("mouseup", () => {
            isRotatingLeft = false;
            isRotatingRight = false;
            isRotating = false;
        });
        button.addEventListener("mouseleave", () => {
            isRotatingLeft = false;
            isRotatingRight = false;
            isRotating = false;
        });
    });

    function moveRobot(key, targetPosition) {
        let newPosition = targetPosition.clone();
        let d = robotGroup.rotation.y;

        switch (key) {
            case "up":
                newPosition.z -= MOVE_DISTANCE * Math.cos(d);
                newPosition.x -= MOVE_DISTANCE * Math.sin(d);
                break;
            case "down":
                newPosition.z += MOVE_DISTANCE * Math.cos(d);
                newPosition.x += MOVE_DISTANCE * Math.sin(d);
                break;
            case "right":
                newPosition.z += -MOVE_DISTANCE * Math.sin(d);
                newPosition.x += MOVE_DISTANCE * Math.cos(d);
                break;
            case "left":
                newPosition.z += MOVE_DISTANCE * Math.sin(d);
                newPosition.x -= MOVE_DISTANCE * Math.cos(d);
                break;
        }
        if (canMoveTo(newPosition)) {
            targetPosition.copy(newPosition);
            robotPosition.copy(targetPosition);
            isMoving = true;
        }
    }
    function updateRobotRotation(directionVector) {
        const targetRotation = Math.atan2(-directionVector.x, directionVector.z);

        const rotationDiff = targetRotation - robotGroup.rotation.y;

        robotGroup.rotation.y += rotationDiff * ROBOT_ROTATE_SPEED;
    }

    let legSwingAngle = 0;

    function animate() {
        if (initialCameraMove) {
            cameraLerpSpeed = INITIAL_CAMERA_LERP_SPEED;
            const cameraOffset = new THREE.Vector3(0, 40, -70);
            const targetPosition = robotGroup.position.clone();
            const cameraPosition = targetPosition.add(cameraOffset);
            const moveCamera = camera.position.clone().lerp(cameraPosition, cameraLerpSpeed);
            camera.position.copy(moveCamera);
            const lookAtPosition = robotGroup.position.clone();
            const offsetLookAt = new THREE.Vector3(0, 0, 0);
            const lookAt = lookAtPosition.add(offsetLookAt).applyQuaternion(robotGroup.quaternion);
            camera.lookAt(lookAt);
            if (camera.position.distanceTo(cameraPosition) < 1) {
                initialCameraMove = false;
            }
        } else {
            cameraLerpSpeed = CAMERA_LERP_SPEED;
        }
        requestAnimationFrame(animate);
        updateJumpAnimation();
        updateMovementAnimation(targetPosition);
        updateCamera();
        updateMinimap();
        world.update();
        checkCollisions(scene, world);
        updateEnemies(world);
        renderer.render(scene, camera);
    }

    function updateJumpAnimation() {
        if (isJumping) {
            jumpHeight += JUMP_SPEED * jumpDirection;
            robotGroup.position.y = BLOCK_SIZE / 2 - 220 + jumpHeight;

            if (jumpHeight >= JUMP_HEIGHT) {
                jumpDirection = -1;
            }

            if (jumpHeight <= 0) {
                jumpDirection = 1;
                jumpHeight = 0;
                isJumping = false;
            }
        }
    }
    function updateMovementAnimation(targetPosition) {
        if (isMoving) {
            const direction = new THREE.Vector3().subVectors(targetPosition, robotGroup.position).normalize();
            const distance = robotGroup.position.distanceTo(targetPosition);
            const moveSpeed = Math.min(distance, MOVE_SPEED);

            if (distance > 1) {
                robotGroup.position.add(direction.multiplyScalar(moveSpeed));

                legSwingAngle += LEG_SWING_SPEED * 0.5;
                leftLeg.rotation.x = Math.sin(legSwingAngle) * 0.5;
                rightLeg.rotation.x = -Math.sin(legSwingAngle) * 0.5;

            } else {
                isMoving = false;
                leftLeg.rotation.x = 0;
                rightLeg.rotation.x = 0;
            }
        }
    }
    function updateCamera() {
        const cameraOffset = new THREE.Vector3(0, 40, -70);
        const targetPosition = robotGroup.position.clone();
        const cameraPosition = targetPosition.add(cameraOffset);
        const moveCamera = camera.position.clone().lerp(cameraPosition, cameraLerpSpeed);
        camera.position.copy(moveCamera);

        const lookAtPosition = robotGroup.position.clone();
        const offsetLookAt = new THREE.Vector3(0, 0, 0);
        const lookAt = lookAtPosition.add(offsetLookAt).applyQuaternion(robotGroup.quaternion);

        if (cameraTransitioning) {
            const currentCameraDirection = new THREE.Vector3().subVectors(camera.position, camera.getWorldDirection(new THREE.Vector3()));
            currentCameraDirection.normalize();

            const lerpedDirection = new THREE.Vector3().lerpVectors(currentCameraDirection, targetCameraDirection, CAMERA_ROTATE_LERP_SPEED);
            const targetLookAt = camera.position.clone().add(lerpedDirection);
            camera.lookAt(targetLookAt);

            if (currentCameraDirection.distanceTo(targetCameraDirection) < 0.01) {
                cameraTransitioning = false;
                cameraRotationOn = true;
            }
        } else {
            camera.lookAt(lookAt);
            if (camera.position.y < 100 && !cameraRotationOn) {
                const currentCameraDirection = new THREE.Vector3().subVectors(camera.position, camera.getWorldDirection(new THREE.Vector3()));
                currentCameraDirection.normalize();
                targetCameraDirection.copy(currentCameraDirection);
                cameraTransitioning = true;
            }
            if (cameraRotationOn) {
                camera.rotation.copy(robotGroup.rotation);
            }
        }
    }
    function onWindowResize() {
        const newWidth = window.innerWidth;
        const newHeight = window.innerHeight;
        renderer.setSize(newWidth, newHeight);
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', onWindowResize, false);

    animate();
}
class Rect {
    constructor(left = 0, top = 0, right = 0, bottom = 0) {
        this.top = top;
        this.right = right;
        this.bottom = bottom;
        this.left = left;
    }

    get width() { return this.right - this.left; }
    get height() { return this.bottom - this.top; }
    get size() { return this.width * this.height; }
    get area() { return this.width * this.height; }
    setPoints(left, top, right, bottom) {
        this.left = left;
        this.top = top;
        this.right = right;
        this.bottom = bottom;
    }
}
class Area {
    constructor() {
        this.section = new Rect();
        this.room = new Rect();
        this.road = null;
        this.divideDirection = "Horizontal";
    }
    setRoad(left, top, right, bottom) {
        this.road = new Rect(left, top, right, bottom);
    }
}
function generateMaze() {
    const width = MAP_SIZE;
    const height = MAP_SIZE;
    const map = Array(width).fill(null).map(() => Array(height).fill(1));
    areaList = [];

    function initFirstArea() {
        const area = new Area();
        area.section.setPoints(0, 0, width - 1, height - 1);
        areaList.push(area);
    }
    function initMap() {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                map[x][y] = 1;
            }
        }
    }
    function divideArea(horizontalDivide) {
        const parentArea = areaList.pop();
        if (!parentArea) return;

        const childArea = horizontalDivide ? divideHorizontally(parentArea) : divideVertially(parentArea);
        if (childArea) {
            drawBorder(parentArea);
            drawBorder(childArea);

            if (parentArea.section.size > childArea.section.size) {
                areaList.push(childArea);
                areaList.push(parentArea);
            } else {
                areaList.push(parentArea);
                areaList.push(childArea);
            }
            divideArea(!horizontalDivide);
        }
    }
    function divideHorizontally(area) {
        area.divideDirection = "Horizontal";
        if (!checkRectSize(area.section.height)) {
            areaList.push(area);
            return null;
        }

        const divideLine = calculateDivideLine(area.section.top, area.section.bottom);
        const childArea = new Area();

        childArea.section.setPoints(area.section.left, divideLine, area.section.right, area.section.bottom);
        area.section.bottom = divideLine;
        return childArea;
    }
    function divideVertially(area) {
        area.divideDirection = "Vertical";
        if (!checkRectSize(area.section.width)) {
            areaList.push(area);
            return null;
        }

        const divideLine = calculateDivideLine(area.section.left, area.section.right);
        const childArea = new Area();

        childArea.section.setPoints(divideLine, area.section.top, area.section.right, area.section.bottom);
        area.section.right = divideLine;
        return childArea;
    }
    function checkRectSize(size) {
        const min = (MIN_ROOM_SIZE + MIN_SPACE_BETWEEN_ROOM_AND_ROAD) * 2 + 1;
        return size >= min;
    }
    function calculateDivideLine(start, end) {
        const min = start + (MIN_ROOM_SIZE + MIN_SPACE_BETWEEN_ROOM_AND_ROAD);
        const max = end - (MIN_ROOM_SIZE + MIN_SPACE_BETWEEN_ROOM_AND_ROAD);
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    function drawBorder(area) {
        for (let y = area.section.top; y <= area.section.bottom; y++) {
            for (let x = area.section.left; x <= area.section.right; x++) {
                if (x === area.section.left || x === area.section.right || y === area.section.top || y === area.section.bottom) {
                    map[x][y] = 3;
                }
            }
        }
    }
    function createRoom() {
        for (const area of areaList) {
            createRoomInArea(area);
        }
    }
    function createRoomInArea(area) {
        let roomLeft = area.section.left + MIN_SPACE_BETWEEN_ROOM_AND_ROAD;
        let roomRight = area.section.right - MIN_SPACE_BETWEEN_ROOM_AND_ROAD + 1;
        let roomTop = area.section.top + MIN_SPACE_BETWEEN_ROOM_AND_ROAD;
        let roomBottom = area.section.bottom - MIN_SPACE_BETWEEN_ROOM_AND_ROAD + 1;

        let isRoomValid = false;
        let attempts = 0;

        while (!isRoomValid && attempts < 1000) {
            adjustRoomSidePosition(roomLeft, roomRight, (newLeft, newRight) => {
                roomLeft = newLeft;
                roomRight = newRight;
            });
            adjustRoomSidePosition(roomTop, roomBottom, (newTop, newBottom) => {
                roomTop = newTop;
                roomBottom = newBottom;
            });

            const roomWidth = roomRight - roomLeft;
            const roomHeight = roomBottom - roomTop;

            if (roomWidth * roomHeight >= 10) {
                isRoomValid = true;
            }
            attempts++;
        }

        if (!isRoomValid) {
            console.error("Failed to create valid room after 1000 attempts.");
            return;
        }
        area.room.setPoints(roomLeft, roomTop, roomRight, roomBottom);

        for (let y = roomTop; y < roomBottom; y++) {
            for (let x = roomLeft; x < roomRight; x++) {
                map[x][y] = 0;
            }
        }
    }
    function adjustRoomSidePosition(minPosition, maxPosition, callback) {
        if (minPosition + MIN_ROOM_SIZE < maxPosition) {
            const maxRange = Math.min(minPosition + MAX_ROOM_SIZE, maxPosition);
            const minRange = minPosition + MIN_ROOM_SIZE;
            const position = Math.floor(Math.random() * (maxRange - minRange + 1)) + minRange;
            const diff = Math.floor(Math.random() * (maxPosition - position - 1));
            callback(minPosition + diff, position + diff);
        }
    }
    function connectRooms() {
        for (let i = 0; i < areaList.length - 1; i++) {
            const parentArea = areaList[i];
            const childArea = areaList[i + 1];
            createRoadBetweenAreas(parentArea, childArea);

            if (i < areaList.length - 2) {                const grandchildArea = areaList[i + 2];
                createRoadBetweenAreas(parentArea, grandchildArea, true);
            }
        }
    }
    function createRoadBetweenAreas(parentArea, childArea, isGrandchild = false) {
        if (parentArea.section.bottom === childArea.section.top || parentArea.section.top === childArea.section.bottom) {
            createVerticalRoad(parentArea, childArea, isGrandchild);
        } else if (parentArea.section.right === childArea.section.left || parentArea.section.left === childArea.section.right) {
            createHorizontalRoad(parentArea, childArea, isGrandchild);
        } else {
            console.log("孫との接続不可能");
        }
    }
    function createVerticalRoad(parentArea, childArea, isGrandchild) {
        let xStart = isGrandchild && parentArea.road ? parentArea.road.left : Math.floor(Math.random() * (parentArea.room.right - parentArea.room.left) + parentArea.room.left);
        let xEnd = isGrandchild && childArea.road ? childArea.road.left : Math.floor(Math.random() * (childArea.room.right - childArea.room.left) + childArea.room.left);
        const connectY = parentArea.section.bottom === childArea.section.top ? childArea.section.top : parentArea.section.top;

        const roadWidth = 5;
        if (parentArea.section.top > childArea.section.top) {
            parentArea.setRoad(xStart - Math.floor(roadWidth / 2), connectY, xStart + Math.floor(roadWidth / 2) + 1, parentArea.room.top);
            childArea.setRoad(xEnd - Math.floor(roadWidth / 2), childArea.room.bottom, xEnd + Math.floor(roadWidth / 2) + 1, connectY);
        } else {
            parentArea.setRoad(xStart - Math.floor(roadWidth / 2), parentArea.room.bottom, xStart + Math.floor(roadWidth / 2) + 1, connectY);
            childArea.setRoad(xEnd - Math.floor(roadWidth / 2), connectY, xEnd + Math.floor(roadWidth / 2) + 1, childArea.room.top);
        }
        drawRoadFromRoomToConnectLine(parentArea);
        drawRoadFromRoomToConnectLine(childArea);
        drawVerticalRoad(xStart, xEnd, connectY);
    }
    function createHorizontalRoad(parentArea, childArea, isGrandchild) {
        let yStart = isGrandchild && parentArea.road ? parentArea.road.top : Math.floor(Math.random() * (parentArea.room.bottom - parentArea.room.top) + parentArea.room.top);
        let yEnd = isGrandchild && childArea.road ? childArea.road.top : Math.floor(Math.random() * (childArea.room.bottom - childArea.room.top) + childArea.room.top);
        let connectX = parentArea.section.right === childArea.section.left ? childArea.section.left : parentArea.section.left;
        const roadWidth = 5;
        if (parentArea.section.left > childArea.section.left) {
            parentArea.setRoad(connectX, yStart - Math.floor(roadWidth / 2), parentArea.room.left, yStart + Math.floor(roadWidth / 2) + 1);
            childArea.setRoad(childArea.room.right, yEnd - Math.floor(roadWidth / 2), connectX, yEnd + Math.floor(roadWidth / 2) + 1);
        } else {
            connectX = childArea.section.left;
            parentArea.setRoad(parentArea.room.right, yStart - Math.floor(roadWidth / 2), connectX, yStart + Math.floor(roadWidth / 2) + 1);
            childArea.setRoad(connectX, yEnd - Math.floor(roadWidth / 2), childArea.room.left, yEnd + Math.floor(roadWidth / 2) + 1);
        }
        drawRoadFromRoomToConnectLine(parentArea);
        drawRoadFromRoomToConnectLine(childArea);
        drawHorizontalRoad(yStart, yEnd, connectX);
    }
    function drawRoadFromRoomToConnectLine(area) {
        if (!area.road) return;
        if (area.road.width === 0 || area.road.height === 0) return;
        for (let y = 0; y < area.road.height; y++) {
            for (let x = 0; x < area.road.width; x++) {
                map[x + area.road.left][y + area.road.top] = 0;
            }
        }
    }
    function drawVerticalRoad(xStart, xEnd, y) {
        for (let x = Math.min(xStart, xEnd); x <= Math.max(xStart, xEnd); x++) {
            map[x][y] = 0;
        }
    }
    function drawHorizontalRoad(yStart, yEnd, x) {
        for (let y = Math.min(yStart, yEnd); y <= Math.max(yStart, yEnd); y++) {
            map[x][y] = 0;
        }
    }

    initMap();
    initFirstArea();
    divideArea(Math.random() < 0.5);
    createRoom();
    connectRooms();

    let goalArea;
    do {
        goalArea = areaList[Math.floor(Math.random() * areaList.length)];
    } while (goalArea === areaList[0]);
    goalX = Math.round((goalArea.room.left + goalArea.room.right) / 2);
    goalZ = Math.round((goalArea.room.top + goalArea.room.bottom) / 2);
    for (let y = goalArea.room.top; y < goalArea.room.bottom; y++) {
        for (let x = goalArea.room.left; x < goalArea.room.right; x++) {
            map[x][y] = 2;
        }
    }

    return map;
}
function createMazeFloor(mazeData, blockSize) {
    const floorGroup = new THREE.Group();
    const numBlocks = mazeData.length;
    const floorColors = [0x696969, 0x808080, 0xA9A9A9];
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });

    for (let y = 0; y < numBlocks; y++) {
        for (let x = 0; x < numBlocks; x++) {
            let blockGeometry;
            let blockMaterial;
            if (mazeData[x][y] === 1) {
                for (let i = 0; i < 5; i++) {
                    blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                    blockMaterial = wallMaterial;
                    const block = new THREE.Mesh(blockGeometry, blockMaterial);
                    block.position.set((x - numBlocks / 2) * blockSize, -256 + blockSize * i, (y - numBlocks / 2) * blockSize);
                    floorGroup.add(block);
                }
            }
            else if (mazeData[x][y] === 0) {
                const floorColor = floorColors[(x + y) % floorColors.length];
                blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                blockMaterial = new THREE.MeshStandardMaterial({
                    color: floorColor,
                    roughness: 0.9,
                    metalness: 0.1
                });
                const block = new THREE.Mesh(blockGeometry, blockMaterial);
                block.position.set((x - numBlocks / 2) * blockSize, -256, (y - numBlocks / 2) * blockSize);
                floorGroup.add(block);
            } else if (mazeData[x][y] === 2) {
                blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                blockMaterial = new THREE.MeshStandardMaterial({
                    color: 0x00ff00,
                    roughness: 0.9,
                    metalness: 0.1
                });
                const block = new THREE.Mesh(blockGeometry, blockMaterial);
                block.position.set((x - numBlocks / 2) * blockSize, -256, (y - numBlocks / 2) * blockSize);
                floorGroup.add(block);
            }
            else if (mazeData[x][y] === 3) {
                for (let i = 0; i < 5; i++) {
                    blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
                    blockMaterial = wallMaterial;
                    const block = new THREE.Mesh(blockGeometry, blockMaterial);
                    block.position.set((x - numBlocks / 2) * blockSize, -256 + blockSize * i, (y - numBlocks / 2) * blockSize);
                    floorGroup.add(block);
                }
            }
        }
    }
    return floorGroup;
}
function canMoveTo(newPosition) {
    const x = Math.round((newPosition.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const z = Math.round((newPosition.z / BLOCK_SIZE) + (MAP_SIZE / 2));
    if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) {
        return false;
    }

    if (mapData[x][z] === 2) {
        endGame("win");
        return true;
    }

    return mapData[x][z] === 0;
}
function initializeExploredMap(size) {
    return Array(size).fill(null).map(() => Array(size).fill(0));
}
function updateMinimap() {
    const playerX = Math.round((robotPosition.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const playerZ = Math.round((robotPosition.z / BLOCK_SIZE) + (MAP_SIZE / 2));
    const viewRange = 10;

    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            const distance = Math.sqrt((x - playerX) ** 2 + (y - playerZ) ** 2);
            if (distance <= viewRange) {
                exploredMap[x][y] = 1;
            }
        }
    }

    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
            if (exploredMap[x][y] === 1) {
                if (mapData[x][y] === 1 || mapData[x][y] === 3) {
                    minimapCtx.fillStyle = '#555';
                } else if (mapData[x][y] === 2) {
                    minimapCtx.fillStyle = 'green';
                } else {
                    minimapCtx.fillStyle = '#aaa';
                }
            } else {
                minimapCtx.fillStyle = '#222';
            }
            minimapCtx.fillRect(x, y, 1, 1);
        }
    }
    minimapCtx.fillStyle = 'white';
    minimapCtx.fillRect(playerX - 1, playerZ - 1, 3, 3);

    minimapCtx.fillStyle = 'red';
    enemies.forEach(enemy => {
        const enemyActor = world._actors.find(actor => actor.threeObject === enemy);
         if(enemyActor){
            const enemyX = Math.round((enemy.position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
            const enemyZ = Math.round((enemy.position.z / BLOCK_SIZE) + (MAP_SIZE / 2));
            if (exploredMap[enemyX][enemyZ]) {
                minimapCtx.beginPath();
                minimapCtx.moveTo(enemyX, enemyZ - 2);
                minimapCtx.lineTo(enemyX + 2, enemyZ + 2);
                minimapCtx.lineTo(enemyX - 2, enemyZ + 2);
                minimapCtx.closePath();
                minimapCtx.fill();
            }
          }
    });
    minimapCtx.fillStyle = 'blue';
    itemPositions.forEach(pos => {
        const itemX = Math.round((pos.x / BLOCK_SIZE) + (MAP_SIZE / 2));
        const itemZ = Math.round((pos.z / BLOCK_SIZE) + (MAP_SIZE / 2));
        if (exploredMap[itemX][itemZ]) {
            minimapCtx.beginPath();
            minimapCtx.arc(itemX, itemZ, 2, 0, Math.PI * 2);
            minimapCtx.fill();
        }
    });
}
function setInitialRobotPosition() {
    if (areaList.length > 0) {
        const firstArea = areaList[0];
        const roomCenterX = (firstArea.room.left + firstArea.room.right) / 2;
        const roomCenterZ = (firstArea.room.top + firstArea.room.bottom) / 2;
        robotPosition = new THREE.Vector3((roomCenterX - MAP_SIZE / 2) * BLOCK_SIZE, BLOCK_SIZE / 2 - 220, (roomCenterZ - MAP_SIZE / 2) * BLOCK_SIZE);
    } else {
        robotPosition = new THREE.Vector3(0, BLOCK_SIZE / 2 - 220, 0);
    }
}
function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        if (timeRemaining <= 0) {
            endGame("timeup");
        }
    }, 1000);
}
function updateTimerDisplay() {
    const statusDisplay = document.getElementById('status-display');
    updateStatusDisplay(statusDisplay);
}
function endGame(result) {
    clearInterval(timerInterval);
    if (result === "win") {
        alert("Game Clear!");
    } else {
        alert("Game Over! Result: " + result);
    }
    location.reload();
}
function placeItemsAndEnemies(scene, world) {
    const itemNumber = 10;
    const enemyNumber = 5;
    itemPositions = [];

    for (let i = 0; i < itemNumber; i++) {
        let position;
        do {
            position = getRandomPosition();
        } while (!isPositionValid(position));
        const itemGeometry = new THREE.SphereGeometry(10 * ITEM_RADIUS_MULTIPLIER, 16, 12);
        const itemMaterial = new THREE.MeshStandardMaterial({ color: 0x0000ff, emissive: 0x0000ff, emissiveIntensity: 1 });
        const item = new THREE.Mesh(itemGeometry, itemMaterial);
        item.position.copy(position);
        item.name = "item";
        item.position.y = BLOCK_SIZE / 2 - 220;
        scene.add(item);
        itemPositions.push(position);
        const itemActor = new ThreeJSActor(item, "item", ITEM_COLLISION_RADIUS_MULTIPLIER);
        world.addActor(itemActor);
    }
    enemyPositions = [];
    for (let i = 0; i < enemyNumber; i++) {
        let position;
        do {
            position = getRandomPosition();
        } while (!isPositionValid(position));
        const enemyGeometry = new THREE.ConeGeometry(40, 80, 32);
        const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 1 });
        const enemy = new THREE.Mesh(enemyGeometry, enemyMaterial);
        enemy.position.copy(position);
        enemy.name = "enemy";
        enemy.position.y = BLOCK_SIZE / 2 - 220;
        scene.add(enemy);
        enemies.push(enemy);
        enemyPositions.push(position);
        const enemyActor = new ThreeJSActor(enemy, "enemy", ENEMY_COLLISION_RADIUS_MULTIPLIER);
        world.addActor(enemyActor);
        enemyHP[enemy.uuid] = INITIAL_HP/3;
        enemyActor.lastAttackTime = 0;
    }
}
function getRandomPosition() {
    const x = Math.floor(Math.random() * MAP_SIZE) - (MAP_SIZE / 2);
    const z = Math.floor(Math.random() * MAP_SIZE) - (MAP_SIZE / 2);
    return new THREE.Vector3(x * BLOCK_SIZE, BLOCK_SIZE / 2 - 220, z * BLOCK_SIZE);
}
function isPositionValid(position) {
    const x = Math.round((position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const z = Math.round((position.z / BLOCK_SIZE) + (MAP_SIZE / 2));
    if (x < 0 || x >= MAP_SIZE || z < 0 || z >= MAP_SIZE) {
        return false;
    }
    const isInitialRoom = areaList.length > 0 ? (x >= areaList[0].room.left && x < areaList[0].room.right && z >= areaList[0].room.top && z < areaList[0].room.bottom) : false;
    const isGoalRoom = (x >= (goalX - 3) && x < (goalX + 3) && z >= (goalZ - 3) && z < (goalZ + 3));
    return mapData[x][z] === 0 && !isInitialRoom && !isGoalRoom;
}
function checkCollisions(scene, world) {
    const playerActor = world._actors.find(actor => actor.type === "player");
    if (!playerActor) return;
    const collidableActors = world._actors.filter(actor => actor !== playerActor);

    collidableActors.forEach(otherActor => {
        if (detectCollision(playerActor, otherActor)) {
            handleCollision(scene, world, playerActor, otherActor);
        }
    });
}
function detectCollision(actor1, actor2) {
    const c1 = actor1.globalCollider;
    const c2 = actor2.globalCollider;

    if (c1.type == 'rectangle' && c2.type == 'rectangle') {
        return this.detectRectangleCollision(c1, c2);
    }
    return false;
}
function detectRectangleCollision(rect1, rect2) {
    const horizontal = (rect2.left < rect1.right) && (rect1.left < rect2.right);
    const vertical = (rect2.top < rect1.bottom) && (rect1.top < rect2.bottom);
    return (horizontal && vertical);
}
function handleCollision(scene, world, playerActor, otherActor) {
    if (otherActor.type === "item") {
        scene.remove(otherActor.threeObject);
        world._actors = world._actors.filter(a => a !== otherActor);
        gainItem(otherActor.threeObject);
        itemPositions = itemPositions.filter(pos => {
            const itemX = Math.round((otherActor.threeObject.position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
            const itemZ = Math.round((otherActor.threeObject.position.z / BLOCK_SIZE) + (MAP_SIZE / 2));
            const posCheckX = Math.round((pos.x / BLOCK_SIZE) + (MAP_SIZE / 2));
            const posCheckZ = Math.round((pos.z / BLOCK_SIZE) + (MAP_SIZE / 2));
            return !(itemX === posCheckX && itemZ === posCheckZ);
        });
        const statusDisplay = document.getElementById('status-display');
        updateStatusDisplay(statusDisplay);

    } else if (otherActor.type === "enemy") {
    }
}
function gainItem(item) {
    items["wallBreaker"].count += 1;
    if (items["wallBreaker"].durability <= 0) {
        items["wallBreaker"].durability = 10;
    }
}
function useItem(scene, world) {
    if (currentItem === "wallBreaker") {
        if (items["wallBreaker"].count > 0 && items["wallBreaker"].durability > 0) {
            breakWall(scene);
            items["wallBreaker"].durability--;
            if (items["wallBreaker"].durability <= 0) {
                items["wallBreaker"].count--;
                if (items["wallBreaker"].count < 0) {
                    items["wallBreaker"].count = 0;
                }
                items["wallBreaker"].durability = 10;
            }
        }
    } else if (currentItem === "attack") {
        attackEnemy(scene, world);
    }
    const statusDisplay = document.getElementById('status-display');
    updateStatusDisplay(statusDisplay);
}
function breakWall(scene) {
    const playerX = Math.round((robotPosition.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const playerZ = Math.round((robotPosition.z / BLOCK_SIZE) + (MAP_SIZE / 2));
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];

    for (const [dx, dz] of directions) {
        const targetX = playerX + dx;
        const targetZ = playerZ + dz;
        if (targetX > 0 && targetX < MAP_SIZE - 1 && targetZ > 0 && targetZ < MAP_SIZE - 1 && (mapData[targetX][targetZ] === 1 || mapData[targetX][targetZ] === 3)) {
            mapData[targetX][targetZ] = 0;
            updateFloor(scene, targetX, targetZ);
            break;
        }
    }
}
function updateFloor(scene, x, z) {
    const blockSize = BLOCK_SIZE;
    const floorColors = [0x696969, 0x808080, 0xA9A9A9];
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 });
    let blockGeometry;
    let blockMaterial;
    if (mapData[x][z] === 1 || mapData[x][z] === 3) {
        for (let i = 0; i < 5; i++) {
            blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
            blockMaterial = wallMaterial;
            const block = new THREE.Mesh(blockGeometry, blockMaterial);
            block.position.set((x - MAP_SIZE / 2) * blockSize, -256 + blockSize * i, (z - MAP_SIZE / 2) * blockSize);
            floorGroup.add(block);
        }
    }
    else if (mapData[x][z] === 0 || mapData[x][z] === 2) {
        const floorColor = floorColors[(x + z) % floorColors.length];
        blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        blockMaterial = new THREE.MeshStandardMaterial({
            color: floorColor,
            roughness: 0.9,
            metalness: 0.1
        });
        const block = new THREE.Mesh(blockGeometry, blockMaterial);
        block.position.set((x - MAP_SIZE / 2) * blockSize, -256, (z - MAP_SIZE / 2) * blockSize);
        floorGroup.add(block);
    }
}
function attackEnemy(scene, world) {
    if (items["wallBreaker"].count > 0 && items["wallBreaker"].durability > 0) {
        items["wallBreaker"].durability--;
        if (items["wallBreaker"].durability <= 0) {
            items["wallBreaker"].count--;
            if (items["wallBreaker"].count < 0) {
                items["wallBreaker"].count = 0;
            }
            items["wallBreaker"].durability = 10;
        }
        const playerX = Math.round((robotPosition.x / BLOCK_SIZE) + (MAP_SIZE / 2));
        const playerZ = Math.round((robotPosition.z / BLOCK_SIZE) + (MAP_SIZE / 2));
         for (const enemy of enemies) {
           const enemyX = Math.round((enemy.position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
            const enemyZ = Math.round((enemy.position.z / BLOCK_SIZE) + (MAP_SIZE / 2));

            const distance = Math.sqrt((enemyX - playerX) ** 2 + (enemyZ - playerZ) ** 2);
            if (distance <= ATTACK_RANGE) {
                const enemyActor = world._actors.find(actor => actor.threeObject === enemy);
                if (enemyActor) {
                    enemyHP[enemy.uuid] -= PLAYER_DAMAGE;
                    if (enemyHP[enemy.uuid] <= 0) {
                        scene.remove(enemy);
                        world._actors = world._actors.filter(a => a !== enemyActor);
                        enemies = enemies.filter(e => e !== enemy);
                        enemyPositions = enemyPositions.filter(pos => {
                            const enemyX = Math.round((enemy.position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
                            const enemyZ = Math.round((enemy.position.z / BLOCK_SIZE) + (MAP_SIZE / 2));
                            const posCheckX = Math.round((pos.x / BLOCK_SIZE) + (MAP_SIZE / 2));
                            const posCheckZ = Math.round((pos.z / BLOCK_SIZE) + (MAP_SIZE / 2));
                            return !(enemyX === posCheckX && enemyZ === posCheckZ);
                        });
                        updateMinimap();
                    }
                }
              }
         }
     }
}
function updateEnemies(world) {
    const playerPosition = robotGroup.position;
    enemies.forEach(enemy => {
        const enemyActor = world._actors.find(actor => actor.threeObject === enemy);
        if (!enemyActor) return;
        const enemyPosition = enemy.position.clone();
        const distanceToPlayer = playerPosition.distanceTo(enemyPosition);

        if (distanceToPlayer <= ENEMY_VIEW_RANGE) {
            const directionToPlayer = new THREE.Vector3().subVectors(playerPosition, enemyPosition).normalize();
            const targetPosition = playerPosition.clone().add(new THREE.Vector3().subVectors(enemyPosition, playerPosition).normalize().multiplyScalar(ENEMY_STOP_DISTANCE));
            const moveDirection = new THREE.Vector3().subVectors(targetPosition, enemyPosition).normalize();
            const moveDistance = Math.min(distanceToPlayer - ENEMY_STOP_DISTANCE, MOVE_SPEED * ENEMY_MOVE_SPEED_MULTIPLIER);
            const newPosition = enemyPosition.clone().add(moveDirection.multiplyScalar(moveDistance));

            if (canMoveTo(newPosition)) {
                const line = new THREE.Line3(enemyPosition, playerPosition);
                if (!checkWallBetweenPoints(line)) {
                    enemy.position.copy(newPosition);
                    updateEnemyRotation(enemy, directionToPlayer);
                    enemyActor.lastSeenPlayerPosition = playerPosition;
                } else if (enemyActor.lastSeenPlayerPosition) {
                    const directionToLastSeen = new THREE.Vector3().subVectors(enemyActor.lastSeenPlayerPosition, enemyPosition).normalize();
                    const targetLastPosition = enemyPosition.clone().add(directionToLastSeen.multiplyScalar(MOVE_SPEED * ENEMY_MOVE_SPEED_MULTIPLIER));
                    if (canMoveTo(targetLastPosition)) {
                        enemy.position.copy(targetLastPosition);
                        updateEnemyRotation(enemy, directionToLastSeen);
                    }
                }
            } else if (enemyActor.lastSeenPlayerPosition) {
                const directionToLastSeen = new THREE.Vector3().subVectors(enemyActor.lastSeenPlayerPosition, enemyPosition).normalize();
                const targetLastPosition = enemyPosition.clone().add(directionToLastSeen.multiplyScalar(MOVE_SPEED * ENEMY_MOVE_SPEED_MULTIPLIER));
                if (canMoveTo(targetLastPosition)) {
                    enemy.position.copy(targetLastPosition);
                    updateEnemyRotation(enemy, directionToLastSeen);
                }
            }
            const currentTime = Date.now();
            if (currentTime - enemyActor.lastAttackTime >= ENEMY_DAMAGE_INTERVAL) {
                fightEnemy(enemy, world);
                enemyActor.lastAttackTime = currentTime;
            }
        }
        if (enemyHP[enemy.uuid] <= 0) {
            scene.remove(enemy);
            world._actors = world._actors.filter(a => a.threeObject !== enemy);
            enemies = enemies.filter(e => e !== enemy);
            enemyPositions = enemyPositions.filter(pos => {
                const enemyX = Math.round((enemy.position.x / BLOCK_SIZE) + (MAP_SIZE / 2));
                const enemyZ = Math.round((enemy.position.z / BLOCK_SIZE) + (MAP_SIZE / 2));
                const posCheckX = Math.round((pos.x / BLOCK_SIZE) + (MAP_SIZE / 2));
                const posCheckZ = Math.round((pos.z / BLOCK_SIZE) + (MAP_SIZE / 2));
                return !(enemyX === posCheckX && enemyZ === posCheckZ);
            });
            updateMinimap();
        }
    });
}
function checkWallBetweenPoints(line) {
    const startX = Math.round((line.start.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const startZ = Math.round((line.start.z / BLOCK_SIZE) + (MAP_SIZE / 2));
    const endX = Math.round((line.end.x / BLOCK_SIZE) + (MAP_SIZE / 2));
    const endZ = Math.round((line.end.z / BLOCK_SIZE) + (MAP_SIZE / 2));

    if (startX < 0 || startX >= MAP_SIZE || startZ < 0 || startZ >= MAP_SIZE) {
        return false;
    }
    if (endX < 0 || endX >= MAP_SIZE || endZ < 0 || endZ >= MAP_SIZE) {
        return false;
    }

    if (mapData[startX][startZ] === 1 || mapData[startX][startZ] === 3) {
        return true;
    }

    if (mapData[endX][endZ] === 1 || mapData[endX][endZ] === 3) {
        return true;
    }

    const dx = Math.abs(endX - startX);
    const dz = Math.abs(endZ - startZ);

    const sx = (startX < endX) ? 1 : -1;
    const sz = (startZ < endZ) ? 1 : -1;

    let err = dx - dz;
    let x = startX;
    let z = startZ;

    while (x !== endX || z !== endZ) {
        const e2 = 2 * err;
        if (e2 > -dz) {
            err -= dz;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            z += sz;
        }
        if (x > 0 && x < MAP_SIZE && z > 0 && z < MAP_SIZE && (mapData[x][z] === 1 || mapData[x][z] === 3)) {
            return true;
        }
    }
    return false;
}
function updateEnemyRotation(enemy, directionVector) {
    const targetRotation = Math.atan2(-directionVector.x, directionVector.z);
    const rotationDiff = targetRotation - enemy.rotation.y;
    enemy.rotation.y += rotationDiff * ROBOT_ROTATE_SPEED;
}
function fightEnemy(enemy, world) {
    const currentTime = Date.now();
    const enemyActor = world._actors.find(actor => actor.threeObject === enemy);
    if (!enemyActor) return;
    playerHP -= ENEMY_DAMAGE;
    if (playerHP <= 0) {
        endGame("lose");
    }
}
function updateStatusDisplay(statusDisplay) {
    statusDisplay.innerHTML = `
           <div class="status-box">
             <div>HP: ${playerHP} / ${MAX_HP}</div>
             <div>Time: ${timeRemaining}</div>
               <div>WallBreaker: ×${items["wallBreaker"].count} (${items["wallBreaker"].durability}/10)</div>
           </div>
         `;
}
class LinearQuadTreeSpace {
    constructor(width, height, level) {
        this._width = width;
        this._height = height;
        this.data = [null];
        this._currentLevel = 0;

        while (this._currentLevel < level) {
            this._expand();
        }
    }
    clear() {
        this.data.fill(null);
    }
    _addNode(node, level, index) {
        const offset = ((4 ** level) - 1) / 3;
        const linearIndex = offset + index;

        while (this.data.length <= linearIndex) {
            this._expandData();
        }

        let parentCellIndex = linearIndex;
        while (this.data[parentCellIndex] === null) {
            this.data[parentCellIndex] = [];

            parentCellIndex = Math.floor((parentCellIndex - 1) / 4);
            if (parentCellIndex >= this.data.length) {
                break;
            }
        }

        const cell = this.data[linearIndex];
        cell.push(node);
    }
    addActor(actor) {
        const collider = actor.globalCollider;

        const leftTopMorton = this._calc2DMortonNumber(collider.left, collider.top);
        const rightBottomMorton = this._calc2DMortonNumber(collider.right, collider.bottom);

        if (leftTopMorton === -1 && rightBottomMorton === -1) {
            this._addNode(actor, 0, 0);
            return;
        }
        if (leftTopMorton === rightBottomMorton) {
            this._addNode(actor, this._currentLevel, leftTopMorton);
            return;
        }
        const level = this._calcLevel(leftTopMorton, rightBottomMorton);

        const larger = Math.max(leftTopMorton, rightBottomMorton);
        const cellNumber = this._calcCell(larger, level);

        this._addNode(actor, level, cellNumber);
    }
    _expand() {
        const nextLevel = this._currentLevel + 1;
        const length = ((4 ** (nextLevel + 1)) - 1) / 3;

        while (this.data.length < length) {
            this.data.push(null);
        }

        this._currentLevel++;
    }
    _expandData() {
        this.data.push(null);
    }
    _separateBit32(n) {
        n = (n | (n << 8)) & 0x00ff00ff;
        n = (n | (n << 4)) & 0x0f0f0f0f;
        n = (n | (n << 2)) & 0x33333333;
        return (n | (n << 1)) & 0x55555555;
    }
    _calc2DMortonNumber(x, y) {
        if (x < 0 || y < 0) {
            return -1;
        }

        if (x > this._width || y > this._height) {
            return -1;
        }
        const xCell = Math.floor(x / (this._width / (2 ** this._currentLevel)));
        const yCell = Math.floor(y / (this._height / (2 ** this._currentLevel)));
        return (this._separateBit32(xCell) | (this._separateBit32(yCell) << 1));
    }
    _calcLevel(leftTopMorton, rightBottomMorton) {
        const xorMorton = leftTopMorton ^ rightBottomMorton;
        let level = this._currentLevel - 1;
        let attachedLevel = this._currentLevel;

        for (let i = 0; level >= 0; i++) {
            const flag = (xorMorton >> (i * 2)) & 0x3;
            if (flag > 0) {
                attachedLevel = level;
            }
            level--;
        }
        return attachedLevel;
    }
    _calcCell(morton, level) {
        const shift = ((this._currentLevel - level) * 2);
        return morton >> shift;
    }
}
class Collider {
    constructor(type, x, y) {
        this._type = type;
        this.x = x;
        this.y = y;
    }

    get type() { return this._type; }
}
class RectangleCollider extends Collider {
    constructor(x, y, width, height) {
        super('rectangle', x, y);
        this.width = width;
        this.height = height;
    }

    translate(dx, dy) {
        return new RectangleCollider(this.x + dx, this.y + dy, this.width, this.height);
    }

    get top() { return this.y; }
    get bottom() { return this.y + this.height; }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
}
class ThreeJSActor {
    type;
    constructor(threeObject, type, collisionRadiusMultiplier = 1) {
      this.threeObject = threeObject;
      this.x = 0;
      this.y = 0;
      const boundingBox = new THREE.Box3().setFromObject(threeObject);
      const width = (boundingBox.max.x - boundingBox.min.x) * collisionRadiusMultiplier;
      const height = (boundingBox.max.z - boundingBox.min.z) * collisionRadiusMultiplier;
      this._collider = new RectangleCollider(0, 0, width, height);
      this.type = type;
  }
  update(info) {
      this.x = this.threeObject.position.x;
      this.y = this.threeObject.position.z;
  }
  hit(other) {
  }
  get globalCollider() {
      const boundingBox = new THREE.Box3().setFromObject(this.threeObject);
      const width = (boundingBox.max.x - boundingBox.min.x) * (this._collider.width / (boundingBox.max.x - boundingBox.min.x));
      const height = (boundingBox.max.z - boundingBox.min.z) * (this._collider.height / (boundingBox.max.z - boundingBox.min.z));
      const localX = this.x;
      const localY = this.y;
      const translatedCollider = new RectangleCollider(localX, localY, width, height);
      return translatedCollider;
  }
}
class CollisionDetector {
  detectCollision(collider1, collider2) {
      if (collider1.type == 'rectangle' && collider2.type == 'rectangle') {
          return this.detectRectangleCollision(collider1, collider2);
      }

      return false;
  }

  detectRectangleCollision(rect1, rect2) {
      const horizontal = (rect2.left < rect1.right) && (rect1.left < rect2.right);
      const vertical = (rect2.top < rect1.bottom) && (rect1.top < rect2.bottom);

      return (horizontal && vertical);
  }
}
class World {
  constructor(width, height) {
      this._width = width;
      this._height = height;

      this._actors = [];

      this._qTree = new LinearQuadTreeSpace(width, height, 3);

      this._detector = new CollisionDetector();
  }

  addActor(actor) {
      this._actors.push(actor);
  }
  update() {
      const info = {
          world: {
              width: this._width,
              height: this._height
          }
      };

      this._actors.forEach((a) => {
          a.update(info);
      });
      this._qTree.clear();

      this._actors.forEach((a) => {
          this._qTree.addActor(a);
      });
      this._hitTest();
  }
  _hitTest(currentIndex = 0, objList = []) {
      const currentCell = this._qTree.data[currentIndex];

      this._hitTestInCell(currentCell, objList);

      let hasChildren = false;
      for (let i = 0; i < 4; i++) {
          const nextIndex = currentIndex * 4 + 1 + i;
          const hasChildCell = (nextIndex < this._qTree.data.length) && (this._qTree.data[nextIndex] !== null);
          hasChildren = hasChildren || hasChildCell;
          if (hasChildCell) {
              objList.push(...currentCell);
              this._hitTest(nextIndex, objList);
          }
      }
      if (hasChildren) {
          const popNum = currentCell ? currentCell.length : 0;
          for (let i = 0; i < popNum; i++) {
              objList.pop();
          }
      }
  }
  _hitTestInCell(cell, objList) {
      if (!cell) return;
      const length = cell.length;
      const cellColliderCahce = new Array(length);
      if (length > 0) { cellColliderCahce[0] = cell[0].globalCollider; }

      for (let i = 0; i < length - 1; i++) {
          const obj1 = cell[i];
          const collider1 = cellColliderCahce[i];
          for (let j = i + 1; j < length; j++) {
              const obj2 = cell[j];
              let collider2;
              if (i === 0) {
                  collider2 = obj2.globalCollider;
                  cellColliderCahce[j] = collider2;
              } else {
                  collider2 = cellColliderCahce[j];
              }
              const hit = this._detector.detectCollision(collider1, collider2);

              if (hit) {
                  obj1.hit(obj2);
                  obj2.hit(obj1);
              }
          }
      }
      const objLength = objList.length;
      const cellLength = cell.length;
      for (let i = 0; i < objLength; i++) {
          const obj = objList[i];
          const collider1 = obj.globalCollider;
          for (let j = 0; j < cellLength; j++) {
              const cellObj = cell[j];
              const collider2 = cellColliderCahce[j];
              const hit = this._detector.detectCollision(collider1, collider2);
              if (hit) {
                  obj.hit(cellObj);
                  cellObj.hit(obj);
              }
          }
      }
  }
  render(context) {
      this._actors.forEach((a) => {
          a.render(context);
      });
  }
}
function switchItem() {
  if (currentItem === "wallBreaker") {
      currentItem = "attack";
  }
  else {
      currentItem = "wallBreaker";
  }
}