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
let global_interval = 0;

let canvas = {
    element : null,
    context : null
};

const util_in_canvas_bound = (x, y) =>
{
    return x >= 0 && x <= canvas.element.width && y >= 0 && y <= canvas.element.height;
};

let player = {
    sprite : new Image(),
    x      : 0,
    y      : 0,
    speed  : 100,

    min_speed : 80,
    max_speed : 300,
    last_move : 0,
    accelerate_time_ms : 1000,

    render : () =>
    {
        canvas.context.drawImage(player.sprite, player.x - PLAYER_CENTER_X, player.y - PLAYER_CENTER_Y);
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
            player.last_move = global_interval;
        }
        else if (player.last_move != 0 && !has_moved) // has stopped moving
        {
            player.last_move = 0;
        }

        // TODO: should prolly use some linear smoothing for this
        const acc_delta = player.max_speed - player.min_speed;
        let goal_ratio = (global_interval - player.last_move) / player.accelerate_time_ms;
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
    global_interval += delta;

    event_update(delta / 1000);
    event_render();
    prev = now;
    window.requestAnimationFrame(event_game_loop);
};

const PROGRESS_TOTAL = 1;
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

    // Check reso
    event_resize();

    player.sprite.onload = () => { commit_progress(); };
    player.sprite.src = './assets/sprites/nanahi_base.png';

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