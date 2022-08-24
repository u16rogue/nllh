// i dont javascript

// TODO: cleanup
// TODO: refactor. should use classes and separate everything in their own JS
// TODO: refactor. object management should be proper

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

let state = {
    interval : 0,
    mouse    : {
        x       : 0,
        y       : 0,
        capture : false,
        m1      : false,
        m2      : false,
    },
    keys : {},
};

let canvas = {
    element : null,
    context : null
};

let bullets = [];

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

const util_math_vun_to_deg = (p) =>
{
    return Math.atan2(p.x, p.y) * 180 / Math.PI;
};

let debug_weapon = {
    sprite : new Image(),
    bullet_sprite : new Image(),
    offset : {
        x : 0,
        y : 10
    },
    next_shot : 0,
    cooldown : 200,
    event_attack : () =>
    {
        if (debug_weapon.next_shot > state.interval) 
            return false;
        
        debug_weapon.next_shot = state.interval + debug_weapon.cooldown;
        
        const bdir = util_math_normalize_towards(player, state.mouse);
        const b_x = player.x + (bdir.x * 25);
        const b_y = player.y + debug_weapon.offset.y + (bdir.y * 25);

        bullets.push({
            origin : {
                x : b_x,
                y : b_y,
                time : state.interval
            },
            position : {
                x : b_x,
                y : b_y,
            },
            sprite : debug_weapon.bullet_sprite,
            own : true,
            speed : 600,
            direction : bdir
        });
        return true;
    },
    event_stopattack : () =>
    {
        return true;
    },
};

let player = {
    sprite : {
        base : new Image(),
        eyes : new Image(),
        arms : new Image(),
    },
    x      : 0,
    y      : 0,
    speed  : 100,

    min_speed : 80,
    max_speed : 300,
    last_move : 0,
    attacking : false,
    accelerate_time_ms : 300,

    weapon : null,

    render : () =>
    {
        canvas.context.fillStyle = "rgb(255, 255, 255)";
        canvas.context.strokeStyle = "rgb(255, 255, 255)";

        let p_abs = {
            x : player.x - PLAYER_CENTER_X,
            y : player.y - PLAYER_CENTER_Y
        };

        if (player.weapon == null)
            canvas.context.drawImage(player.sprite.arms, p_abs.x, p_abs.y);
        canvas.context.drawImage(player.sprite.base, p_abs.x, p_abs.y);
        
        // Track player mouse
        const p2m_unit = util_math_normalize_towards(player, state.mouse);
        canvas.context.drawImage(player.sprite.eyes, p_abs.x + (p2m_unit.x * 1.0), p_abs.y + (p2m_unit.y * 1.0));

        const weapon = player.weapon;
        if (weapon != null)
        {
            let winfo = {
                x : p_abs.x + weapon.offset.x,
                y : p_abs.y + weapon.offset.y,
                w : weapon.sprite.width,
                h : weapon.sprite.height
            };
            canvas.context.save();
            canvas.context.translate(winfo.x + (winfo.w / 2), winfo.y + (winfo.h / 2));
            const deg = util_math_vun_to_deg(p2m_unit);
            canvas.context.rotate(-(deg - 90) * Math.PI / 180);
            if (deg < 0)
                canvas.context.scale(1, -1);
            canvas.context.drawImage(weapon.sprite, -winfo.w / 2, -winfo.h / 2);
            canvas.context.restore();
        }

        // DEBUG
        if (DEBUG)
        {
            /*
            
            canvas.context.beginPath();
            canvas.context.moveTo(player.x, player.y);
            const test_dir = util_math_forward_towards(player, state.mouse, 50);
            canvas.context.lineTo(test_dir.x, test_dir.y);
            canvas.context.closePath();
            canvas.context.stroke();
            */

            canvas.context.fillText(
                "DEBUG >> Speed: " + Math.round(player.speed) +
                " m_x:" + state.mouse.x +
                " m_y:" + state.mouse.y +
                " p_x:" + Math.round(p_abs.x) +
                " p_y:" + Math.round(p_abs.y) +
                " n_bullets:" + bullets.length/*+
                " t_x:" + test_dir.x +
                " t_y:" + test_dir.y */
                , 5, CANVAS_HEIGHT - 5);
        }
    },
    update : (ratio) =>
    {
        let n_x = player.x;
        let n_y = player.y;
        if ('w' in state.keys)
            n_y -= player.speed * ratio;
        if ('s' in state.keys)
            n_y += player.speed * ratio;
        if ('a' in state.keys)
            n_x -= player.speed * ratio;
        if ('d' in state.keys)
            n_x += player.speed * ratio;

        const has_moved = n_x != player.x || n_y != player.y;
        if (player.last_move == 0 && has_moved) // has not moved previously
        {
            player.last_move = state.interval;
        }
        else if (player.last_move != 0 && !has_moved) // has stopped moving
        {
            player.last_move = 0; // TODO: this is why deaccel isnt working, should track this somewhere else
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

        if (player.weapon != null)
        {
            if (state.mouse.m1)
            {
                player.weapon.event_attack();
                player.attacking = true;
            }
            else if (!state.mouse.m1 && player.attacking)
            {
                player.weapon.event_stopattack();
                player.attacking = false;
            }
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

    if (DEBUG)
        player.weapon = debug_weapon;
};

const event_render = () =>
{
    canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
    player.render();

    // Render bullets
    bullets.forEach(bullet => {
        canvas.context.drawImage(bullet.sprite, bullet.position.x - (bullet.sprite.width / 2), bullet.position.y - (bullet.sprite.height / 2));
    });
};

const event_update = (ratio) =>
{
    player.update(ratio);

    // Update bullets
    let i = 0;
    bullets.forEach(bullet => {
        const n_x = bullet.position.x + (bullet.speed * ratio * bullet.direction.x);
        const n_y = bullet.position.y + (bullet.speed * ratio * bullet.direction.y);
        
        // Interpolate hitscan from bullet.position to n_x/y

        bullet.position = {
            x : n_x,
            y : n_y,
        };

        if (!util_in_canvas_bound(n_x, n_y))
            bullets.splice(i, 1);
        ++i;
    });

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

const PROGRESS_TOTAL = 5;
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

    addEventListener('keydown', (e) => { state.keys[e.key] = true;});
    addEventListener('keyup', (e) => { delete state.keys[e.key]; });
    document.body.onmousedown = (e) =>
    {
        if (e.button == 0)
            state.mouse.m1 = true;
    };
    document.body.onmouseup = (e) =>
    {
        if (e.button == 0)
            state.mouse.m1 = false;
    };
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

    player.sprite.arms.onload = () => { commit_progress(); };
    player.sprite.arms.src = './assets/sprites/nanahi_arms.png';

    debug_weapon.sprite.onload = () => { commit_progress(); };
    debug_weapon.sprite.src = './assets/sprites/test_weapon.png';

    debug_weapon.bullet_sprite.onload = () => { commit_progress(); };
    debug_weapon.bullet_sprite.src = './assets/sprites/test_bullet.png';

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