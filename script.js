const DEBUG = true;

const $ = (id, action = null) =>
{
    let obj = document.getElementById(id) ?? document.getElementsByClassName(id);
    if (obj == null)
        return null;

    if (action == null)
        return obj;
    return action(obj);
};

const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 600;

const PLAYER_SPRITE_WIDTH  = 64;
const PLAYER_SPRITE_HEIGHT = 64;

let CANVAS_CENTER_X = CANVAS_WIDTH  / 2;
let CANVAS_CENTER_Y = CANVAS_HEIGHT / 2;

let PLAYER_CENTER_X = PLAYER_SPRITE_WIDTH  / 2;
let PLAYER_CENTER_Y = PLAYER_SPRITE_HEIGHT / 2;

let keys = {};

let state = {
    interval : 0,
    mouse    : {
        x       : 0,
        y       : 0,
        capture : false
    }
};

let canvas = {
    element : null,
    context : null
};

const util_in_canvas_bound = (x, y) =>
{
    return x >= 0 && x <= canvas.element.width && y >= 0 && y <= canvas.element.height;
};

const util_math_distance = (p1, p2) =>
{
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const util_math_normalize_towards = (p1, p2) =>
{
    const dist = util_math_distance(p2, p1);
    return {
        x: (p2.x - p1.x) / dist,
        y: (p2.y - p1.y) / dist
    };
};

const util_math_normalize = (p) =>
{
    const n = Math.sqrt(Math.pow(p.x, 2) + Math.pow(p.y, 2));
    return {
       x : p.x / n,
       y : p.y / n 
    };
};

const util_math_forward_towards = (p1, p2, distance) =>
{
    const vun = util_math_normalize_towards(p1, p2);
    return {
        x : p1.x + (vun.x * distance),
        y : p1.y + (vun.y * distance)
    };
};

let player = {
    sprite : {
        base : new Image(),
        eyes : new Image()
    },
    x      : 0,
    y      : 0,
    speed  : 100,

    min_speed : 80,
    max_speed : 300,
    last_move : 0,
    accelerate_time_ms : 600,

    render : () =>
    {
        let p_abs = {
            x : player.x - PLAYER_CENTER_X,
            y : player.y - PLAYER_CENTER_Y
        };

        canvas.context.drawImage(player.sprite.base, p_abs.x, p_abs.y);
        canvas.context.drawImage(player.sprite.eyes, p_abs.x, p_abs.y);

        // DEBUG
        if (DEBUG)
        {
            canvas.context.fillStyle = "rgb(255, 255, 255)";
            canvas.context.strokeStyle = "rgb(255, 255, 255)";

            /*
            canvas.context.beginPath();
            canvas.context.moveTo(player.x, player.y);
            const test_dir = util_math_forward_towards(player, state.mouse, 200);
            canvas.context.lineTo(test_dir.x, test_dir.y);
            canvas.context.closePath();
            canvas.context.stroke();
            */
            canvas.context.fillText(
                "DEBUG >> Speed: " + player.speed +
                " m_x:" + state.mouse.x +
                " m_y:" + state.mouse.y +
                " p_x:" + p_abs.x +
                " p_y:" + p_abs.y /*+
                " t_x:" + test_dir.x +
                " t_y:" + test_dir.y */
                , 20, CANVAS_HEIGHT - 5);
        }
    },
    update : (ratio) =>
    {
        let n_x = player.x;
        let n_y = player.y;
        if ('w' in keys)
            n_y -= player.speed * ratio;
        if ('s' in keys)
            n_y += player.speed * ratio;
        if ('a' in keys)
            n_x -= player.speed * ratio;
        if ('d' in keys)
            n_x += player.speed * ratio;

        const has_moved = n_x != player.x || n_y != player.y;
        if (player.last_move == 0 && has_moved) // has not moved previously
        {
            player.last_move = state.interval;
        }
        else if (player.last_move != 0 && !has_moved) // has stopped moving
        {
            player.last_move = 0;
        }

        // TODO: should prolly use some linear smoothing for this
        // TODO: deaccel is broken
        const acc_delta = player.max_speed - player.min_speed;
        let goal_ratio = (state.interval - player.last_move) / player.accelerate_time_ms;
        if (goal_ratio >= 1.0)
            goal_ratio = 1.0;
        if (has_moved && player.speed != player.max_speed) // if we're not in the speed cap and we're moving start accelerating
        {
            player.speed = player.min_speed + (acc_delta * goal_ratio);
        }
        else if (!has_moved && player.speed != player.min_speed) // if we're no longer moving but still have some acceleration, start decreasing
        { 
            player.speed = player.min_speed + (acc_delta * (1.0 - goal_ratio));
        }

        // clamp speed
        if (player.speed > player.max_speed)
            player.speed = player.max_speed;
        else if (player.speed < player.min_speed)
            player.speed = player.min_speed;

        if (util_in_canvas_bound(n_x, n_y))
        {
            player.x = n_x;
            player.y = n_y;
        }
    }
};

const event_resize = () =>
{
    $('topnav', (tn) => { $('resowarning', (rw) => { rw.style.display = (tn.offsetHeight == 100 ? 'none' : 'block'); }); }); // Update warning

    // Update constants
};

const event_load_complete = () =>
{
    player.x = CANVAS_CENTER_X;
    player.y = CANVAS_CENTER_Y;
};

const event_render = () =>
{
    canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
    player.render();
};

const event_update = (ratio) =>
{
    player.update(ratio);
};

let prev = Date.now();
const event_game_loop = () =>
{
    const now   = Date.now();
    const delta = now - prev;
    state.interval += delta;
    state.m_x

    event_update(delta / 1000);
    event_render();
    prev = now;
    window.requestAnimationFrame(event_game_loop);
};

const PROGRESS_TOTAL = 2;
let   load_progress  = 0;
let   has_loaded     = false;

let commit_progress = () => {
    ++load_progress;
    if (load_progress >= PROGRESS_TOTAL)
    {
        event_load_complete();
        commit_progress = () => { return true; }; // disable commit progress
        has_loaded = true;
        return true;
    }

    return false;
};

// Remove JS alert and start load
$('jswarning', (d) =>
{
    d.remove();

    addEventListener('resize', event_resize);

    // Create canvas - http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/ 
    canvas.element = document.createElement('canvas');
    canvas.context = canvas.element.getContext('2d');

    canvas.element.width  = CANVAS_WIDTH;
    canvas.element.height = CANVAS_HEIGHT;
    canvas.element.classList.add('canvasstyle');
    $('canvascont', (cc) => { cc.appendChild(canvas.element); });

    addEventListener('keydown', (e) => { keys[e.key] = true;});
    addEventListener('keyup', (e) => { delete keys[e.key]; });
    addEventListener('mousemove', (e) =>
    {
        const bcr = canvas.element.getBoundingClientRect();
        const n_x = e.clientX - bcr.left;
        const n_y = e.clientY - bcr.top;
        
        state.mouse.capture = n_x >= 0 && n_x <= CANVAS_WIDTH && n_y >= 0 && n_y <= CANVAS_HEIGHT;
        if (state.mouse.capture)
        {
            state.mouse.x = n_x;
            state.mouse.y = n_y;
        }

    });

    // Check reso
    event_resize();

    player.sprite.base.onload = () => { commit_progress(); };
    player.sprite.base.src = './assets/sprites/nanahi_base.png';

    player.sprite.eyes.onload = () => { commit_progress(); };
    player.sprite.eyes.src = './assets/sprites/nanahi_eyes.png';


    // Wait for everything to load then Trigger event loop
    console.log('Waiting for everything to load...');
    const wait_load = setInterval(() =>
    {
        if (!has_loaded)
            return;
        event_game_loop();
        clearInterval(wait_load);
        console.log('Load wait ended, event loop started, interval unregistered!');
    }, 500);
});