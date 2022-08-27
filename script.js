// TODO: cleanup
// TODO: refactor. should use classes and separate everything in their own JS
// TODO: refactor. object management should be proper

const DEBUG = false;

const CANVAS_WIDTH  = 800;
const CANVAS_HEIGHT = 600;

const STONE_WALL_THICKNESS = 60; // This affects the boundary calculation
const STONE_WALL_LEISURE   = -5; // it would not look great if we immediately stop when hitting the literal edge of a wall, this gives us a little bit of space.
                                 // why is it separate? because the thickness defines the drawing size while this subtracts and creates the actual bounding size

// cycle time for each hairband animation frame
const HAIRBAND_IDLE_CYCLE   = 1200;
const HAIRBAND_MOVING_CYCLE = 400;

const LEG_CYCLE_TIME = 400; // cycle time for leg animation switch

const GRAVES_N_SPAWN = 4; // number of graves to randomly spawn
const GRAVE_COLLISION_RADIUS = 30;

const EYE_TRACK_DIFF = 1.5; // how far will the eyes move when tracking something

const PLAYER_SHOOT_SPEED_PENALTY = 30;

const ZOMBIE_MAX_SPAWN = -1; // set to -1 for infinite
const ZOMBIE_SPAWN_INTERVAL = 600;
const ZOMBIE_SPAWN_CHANCE   = 100 - 80;
const ZOMBIE_BITE_CONFIRM_INTERVAL = 300; // time it takes for the player to be in the attack radius before we dish out damage

const DAMAGE_COVER_INTERVAL = 100; // How long will the red overlay damage indicator

const $ = (id, action = null) =>
{
    let obj = document.getElementById(id) ?? document.getElementsByClassName(id);
    if (obj == null)
        return null;

    if (action == null)
        return obj;
    return action(obj);
};

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
    pause : true,
    fresh : true,
    next_spawn : 0,
    resources : {
        dirt : {
            sprite : new Image(),
            pattern : null
        },
        stone : {
            sprite : new Image(),
            pattern : null
        },
        grave : {
            sprites : []
        },
        bullet : {
            sprite : new Image()
        },
        dead : {
            sprites : {
                base : new Image(),
                arm_l : new Image(),
                arm_r : new Image(),
                walk_cycle : []
            }
        }
    },
};

let canvas = {
    element : null,
    context : null
};

let bullets = [];
let graves = []; // enemy spawn points
let enemies = [];

const util_in_canvas_bound = (x, y) =>
{
    // yes the 0 is unecessary but
    return x >= (0 + STONE_WALL_THICKNESS + STONE_WALL_LEISURE)
        && x <= (canvas.element.width - STONE_WALL_THICKNESS - STONE_WALL_LEISURE)
        && y >= (0 + STONE_WALL_THICKNESS + STONE_WALL_LEISURE)
        && y <= (canvas.element.height - STONE_WALL_THICKNESS + STONE_WALL_LEISURE);
};

const util_math_easeincirc = (r) =>
{
    return 1 - Math.sqrt(1 - Math.pow(r, 2));
};

const util_math_easeinsine = (r) =>
{
     return 1 - Math.cos((r * Math.PI) / 2);
};

const util_math_distance = (p1, p2) =>
{
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
};

const util_math_normalize_towards = (p1, p2) =>
{
    const dist = util_math_distance(p1, p2);
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

const util_rand_num = (low, high) =>
{
    return (Math.floor(Math.random() * (high - low)) + low);
};

const util_spawn_bullet = (x_, y_, own_, speed_, sprite_, dir_, hitradius_, damage_, oriented_) =>
{
    bullets.push({
        origin : {
            x : x_,
            y : y_,
            time : state.interval
        },
        position : {
            x : x_,
            y : y_,
        },
        damage : damage_,
        sprite : sprite_,
        own : own_,
        speed : speed_,
        direction : dir_,
        hitradius : hitradius_,
        is_oriented : oriented_ // This will run calculation to proper align the angle of the shot to path, incase we have a circle projectiles we dont need the expensive math for that
    });
};

const util_create_enemy_spawn_point = (x_, y_, sprite_, callback_should_spawn_) =>
{
    graves.push({
        x : x_,
        y : y_,
        sprite : sprite_,
        cb_sspawn : callback_should_spawn_, 
    });
};

const util_spawn_enemy = (x_, y_, hp_, speed_, collission_radius_, attack_radius_, cb_render_) =>
{
    enemies.push({
        x : x_,
        y : y_,
        hp : hp_,
        speed : speed_,
        collission_radius : collission_radius_,
        attack_radius : attack_radius_,
        render : cb_render_,
        confirm_bite : 0
    });
};

const util_spawn_enemy_zombie = (x_, y_, hp_, speed_) =>
{
    util_spawn_enemy(x_, y_, hp_, speed_, 20, 26, (self) => {
        const swh = state.resources.dead.sprites.base.width  / 2;
        const shh = state.resources.dead.sprites.base.height / 2;
        let s_abs = {
            x : self.x - swh,
            y : self.y - shh,
        };
        
        // leg cycle render
        canvas.context.drawImage(state.resources.dead.sprites.walk_cycle[Math.floor(state.interval % LEG_CYCLE_TIME / (LEG_CYCLE_TIME / state.resources.dead.sprites.walk_cycle.length))], s_abs.x, s_abs.y);

        canvas.context.drawImage(state.resources.dead.sprites.base, s_abs.x, s_abs.y);
        
        // eye tracker
        let e2p_vun = util_math_normalize_towards(s_abs, player);
        canvas.context.drawImage(player.sprites.eyes, s_abs.x + (e2p_vun.x * EYE_TRACK_DIFF), s_abs.y + (e2p_vun.y * EYE_TRACK_DIFF));

        const deg = util_math_vun_to_deg(e2p_vun);

        // arm tracker left
        canvas.context.save();
        canvas.context.translate(self.x - swh / 4, self.y + shh / 4);
        canvas.context.rotate(-deg * Math.PI / 180);
        canvas.context.drawImage(state.resources.dead.sprites.arm_l, -swh, -shh);
        canvas.context.restore();

        // arm tracker right
        canvas.context.save();
        canvas.context.translate(self.x + swh / 4, self.y + shh / 4);
        canvas.context.rotate(-deg * Math.PI / 180);
        canvas.context.drawImage(state.resources.dead.sprites.arm_r, -swh, -shh);
        canvas.context.restore();
    });
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
        
        const BULLET_SPAWN_OFFSET = 25;
        const bdir = util_math_normalize_towards(player, state.mouse);
        const b_x = player.x + (bdir.x * BULLET_SPAWN_OFFSET);
        const b_y = player.y + debug_weapon.offset.y + (bdir.y * BULLET_SPAWN_OFFSET);

        util_spawn_bullet(b_x, b_y, true, 600, debug_weapon.bullet_sprite, bdir, 4, 1, true);
        player.max_speed = PLAYER_SHOOT_SPEED_PENALTY;
        return true;
    },
    event_stopattack : () =>
    {
        player.max_speed = 300;
        return true;
    },
};

const reset_state = () =>
{
    enemies = [];
    bullets = [];
    state.keys = {};
    player.hp = 3;
    state.interval = 0;
    state.next_spawn = 0;
    player.kills = 0;
    player.last_damage = 0;
    debug_weapon.next_shot = 0; 
}

let player = {
    sprites : {
        base : new Image(),
        eyes : new Image(),
        arms : new Image(),
        hairband : {
            sprite : new Image(),
            idle : new Image(),
            cycle : []
        },
        legs : {
            sprite : null,
            idle : new Image(),
            cycle : [ ]
        }, 
    },
    hp     : 3,
    last_damage : -DAMAGE_COVER_INTERVAL - 1,
    kills  : 0,
    x      : 0,
    y      : 0,
    speed  : 100,

    min_speed : 80,
    max_speed : 300,
    last_move : 0,
    attacking : false,
    accelerate_time_ms : 300,
    hairband_cycle_time : 1200,

    weapon : null,

    render : () =>
    {
        let p_abs = {
            x : player.x - player.sprites.base.width / 2,
            y : player.y - player.sprites.base.height / 2,
        };

        canvas.context.drawImage(player.sprites.legs.sprite, p_abs.x, p_abs.y);
        if (player.weapon == null)
            canvas.context.drawImage(player.sprites.arms, p_abs.x, p_abs.y);
        canvas.context.drawImage(player.sprites.base, p_abs.x, p_abs.y);
        canvas.context.drawImage(player.sprites.hairband.sprite, p_abs.x, p_abs.y);
        
        // Track player mouse
        const p2m_unit = util_math_normalize_towards(player, state.mouse);
        canvas.context.drawImage(player.sprites.eyes, p_abs.x + (p2m_unit.x * EYE_TRACK_DIFF), p_abs.y + (p2m_unit.y * EYE_TRACK_DIFF));

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
            canvas.context.fillStyle = "rgb(255, 255, 255)";
            canvas.context.strokeStyle = "rgb(255, 255, 255)";

            canvas.context.beginPath();
            canvas.context.moveTo(player.x, player.y);
            const test_dir = util_math_forward_towards(player, state.mouse, 50);
            canvas.context.lineTo(test_dir.x, test_dir.y);
            canvas.context.closePath();
            canvas.context.stroke();

            canvas.context.fillText(
                "DEBUG >> Speed: " + Math.round(player.speed) +
                " m_x:" + state.mouse.x +
                " m_y:" + state.mouse.y +
                " p_x:" + Math.round(p_abs.x) +
                " p_y:" + Math.round(p_abs.y) +
                " n_bullets:" + bullets.length +
                " w_cycle:" + player.sprites.legs.sprite.src/*+
                " t_x:" + test_dir.x +
                " t_y:" + test_dir.y */
                , 5, CANVAS_HEIGHT - 20);
        }
    },
    update : (ratio) =>
    {
        if (player.hp <= 0)
        {
            alert(`You died!\nTotal kills: ${player.kills}\nTime survived: ${state.interval / 1000}\n\nPress OK to try again!`);
            reset_state();
            player.x = CANVAS_WIDTH / 2;
            player.y = CANVAS_HEIGHT / 2;
            return;
        }

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
            player.hairband_cycle_time = HAIRBAND_MOVING_CYCLE;
        }
        else if (player.last_move != 0 && !has_moved) // has stopped moving
        {
            player.last_move = 0; // TODO: this is why deaccel isnt working, should track this somewhere else
            player.sprites.legs.sprite = player.sprites.legs.idle;
            player.hairband_cycle_time = HAIRBAND_IDLE_CYCLE;
        }

        if (has_moved)
        {
            player.sprites.legs.sprite = player.sprites.legs.cycle[Math.floor((state.interval % LEG_CYCLE_TIME / (LEG_CYCLE_TIME / player.sprites.legs.cycle.length)))];
        }

        player.sprites.hairband.sprite = player.sprites.hairband.cycle[Math.floor((state.interval % player.hairband_cycle_time / (player.hairband_cycle_time / player.sprites.hairband.cycle.length)))];

        // TODO: deaccel is broken
        const acc_delta = player.max_speed - player.min_speed;
        let goal_ratio = (state.interval - player.last_move) / player.accelerate_time_ms;
        if (goal_ratio >= 1.0)
            goal_ratio = 1.0;
        if (has_moved && player.speed != player.max_speed) // if we're not in the speed cap and we're moving start accelerating
        {
            player.speed = player.min_speed + (acc_delta * util_math_easeinsine(goal_ratio));
        }
        else if (!has_moved && player.speed != player.min_speed) // if we're no longer moving but still have some acceleration, start decreasing
        { 
            // easeInCirc
            player.speed = player.min_speed + (acc_delta * (1.0 - goal_ratio));
        }

        // clamp speed
        if (player.speed > player.max_speed)
            player.speed = player.max_speed;
        else if (player.speed < player.min_speed)
            player.speed = player.min_speed;

        let has_collide = false;

        // Grave collision
        for (let grave of graves)
        {
            if (util_math_distance({ x: n_x, y : n_y }, grave) < GRAVE_COLLISION_RADIUS)
            {
                has_collide = true;
                break;
            }
        }

        // Player to enemy collision
        if (!has_collide)
        {
            for (let enemy of enemies)
            {
                if (util_math_distance({ x: n_x, y : n_y }, enemy) < enemy.collission_radius)
                {
                    has_collide = true;
                    break;
                }   
            }
        }

        if (!has_collide && util_in_canvas_bound(n_x, n_y))
        {
            player.x = n_x;
            player.y = n_y;
        }

        if (player.weapon != null && state.mouse.capture)
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
    player.x = canvas.element.width / 2;
    player.y = canvas.element.height / 2;
    player.sprites.legs.sprite = player.sprites.legs.idle;
    player.sprites.hairband.sprite = player.sprites.hairband.idle;
    state.resources.dirt.pattern = canvas.context.createPattern(state.resources.dirt.sprite, 'repeat');
    state.resources.stone.pattern = canvas.context.createPattern(state.resources.stone.sprite, 'repeat');
    debug_weapon.bullet_sprite = state.resources.bullet.sprite;

    // Spawn a bunch of graves
    for (let i = 0; i < GRAVES_N_SPAWN; ++i)
    {
        const GRAVE_SIZE = 64; // dumb magic number but idk how to properly implement this incase we have diff grave sizes but for now it'll work
        const min_x = STONE_WALL_THICKNESS + GRAVE_SIZE;
        const max_x = canvas.element.width - STONE_WALL_THICKNESS - GRAVE_SIZE;
        const min_y = min_x;
        const max_y = canvas.element.height - STONE_WALL_THICKNESS - GRAVE_SIZE;

        let cx = 0;
        let cy = 0;

        // Make sure no graves are on top of each other and it doesnt spawn on the player
        do
        {
            cx = util_rand_num(min_x, max_x);
            cy = util_rand_num(min_y, max_y);

            if (util_math_distance({ x : cx, y : cy }, player) <= GRAVE_COLLISION_RADIUS)
            {
                continue;
            }
            else
            {
                let has_too_close = false;
                for (let grave of graves)
                {
                    if (util_math_distance({ x : cx, y : cy }, grave) <= GRAVE_COLLISION_RADIUS)
                    {
                        has_too_close = true;
                        break;
                    }
                }

                if (has_too_close)
                    continue;
            }

            break;

        } while (true);

        util_create_enemy_spawn_point(
            cx,
            cy,
            state.resources.grave.sprites[util_rand_num(0, state.resources.grave.sprites.length)],
            (grave) => { return false; }
        );
    }

    /*if (DEBUG)*/ player.weapon = debug_weapon;


    alert('WARNING: Contains flashing red light!\nW A S D - Move\nLMB - Shoot\nMouse Pointer - Aim\nESC - Pause');
};

const event_render = () =>
{
    canvas.context.clearRect(0, 0, canvas.element.width, canvas.element.height);
    
    // Render ground
    canvas.context.fillStyle = state.resources.dirt.pattern;
    canvas.context.fillRect(0, 0, canvas.element.width, canvas.element.height);

    // Render walls
    canvas.context.fillStyle = state.resources.stone.pattern;
    // Top walls
    canvas.context.fillRect(0, 0, canvas.element.width, STONE_WALL_THICKNESS);
    // Left walls
    canvas.context.fillRect(0, STONE_WALL_THICKNESS, STONE_WALL_THICKNESS, canvas.element.height - STONE_WALL_THICKNESS);
    // Right walls
    canvas.context.fillRect(canvas.element.width - STONE_WALL_THICKNESS, STONE_WALL_THICKNESS, STONE_WALL_THICKNESS, canvas.element.height - STONE_WALL_THICKNESS);
    // Bottom walls
    canvas.context.fillRect(STONE_WALL_THICKNESS, canvas.element.height - STONE_WALL_THICKNESS, canvas.element.width - (STONE_WALL_THICKNESS * 2), STONE_WALL_THICKNESS);

    // Render graves
    graves.forEach(grave => {
        canvas.context.drawImage(grave.sprite, grave.x - (grave.sprite.width / 2), grave.y - grave.sprite.height / 2);
    });

    player.render();

    // Render enemies
    enemies.forEach(enemy => {
        enemy.render(enemy);
    });

    // Render bullets
    bullets.forEach(bullet => {
        if (bullet.is_oriented)
        {
            canvas.context.save();
            canvas.context.translate(bullet.position.x, bullet.position.y);
            const deg = util_math_vun_to_deg(bullet.direction);
            canvas.context.rotate(-(deg - 90) * Math.PI / 180);
            canvas.context.drawImage(bullet.sprite, -bullet.sprite.width / 2, -bullet.sprite.height / 2);
            canvas.context.restore();
        }
        else
        {
            canvas.context.drawImage(bullet.sprite, bullet.position.x - (bullet.sprite.width / 2), bullet.position.y - (bullet.sprite.height / 2));
        }
    });

    if (DEBUG)
    {
        canvas.context.fillStyle = "rgb(255, 255, 255)";
        canvas.context.fillText('n_grave:' + graves.length +
                                ' n_enemies:' + enemies.length + '/' + ZOMBIE_MAX_SPAWN +
                                ' n_loaded:' + load_progress + '/' + PROGRESS_TOTAL
                                , 5, CANVAS_HEIGHT - 5);

        graves.forEach(grave => {
            canvas.context.beginPath();
            canvas.context.arc(grave.x, grave.y, GRAVE_COLLISION_RADIUS, 0, 360);
            canvas.context.stroke();
        });

        enemies.forEach(enemy => {
            canvas.context.beginPath();
            canvas.context.arc(enemy.x, enemy.y, enemy.collission_radius, 0, 360);
            canvas.context.arc(enemy.x, enemy.y, enemy.attack_radius, 0, 360);
            canvas.context.stroke();
        });

        bullets.forEach(bullet => {
            canvas.context.beginPath();
            canvas.context.arc(bullet.position.x, bullet.position.y, bullet.hitradius, 0, 360);
            canvas.context.stroke();
        });
    }

    // Render damage indicator
    const dmg_end = player.last_damage + DAMAGE_COVER_INTERVAL;
    if (dmg_end > state.interval)
    {
        canvas.context.save();
        canvas.context.fillStyle = `rgb(255, 0, 0)`;
        canvas.context.globalAlpha = ((dmg_end - state.interval) / DAMAGE_COVER_INTERVAL);
        if (canvas.context.globalAlpha > 0.5)
            canvas.context.globalAlpha = 0.5;
        canvas.context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        canvas.context.restore();
    }

    // Render text
    canvas.context.save();
    canvas.context.fillStyle = "rgb(255, 255, 255)";
    canvas.context.font = "46px visitor";
    canvas.context.fillText('HP: ' + player.hp + ' KILLS: ' + player.kills, 20, 30);
    canvas.context.fillText('TIME: ' + (state.interval / 1000) + (state.pause ? ' (Paused)' : ''), 20, 55);
    canvas.context.restore();

    // TODO: render pause banner thing
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

        let has_collided = false;

        // Check if colliding with a grave
        for (let grave of graves)
        {
            if (util_math_distance(bullet.position, grave) < GRAVE_COLLISION_RADIUS)
            {
                has_collided = true;
                break;
            }
        }

        // enemy hit
        if (!has_collided)
        {
            for (let enemy of enemies)
            {
                if (util_math_distance(bullet.position, enemy) < enemy.collission_radius + bullet.hitradius)
                {
                    enemy.hp -= bullet.damage;
                    has_collided = true;
                    break;
                }
            }
        }

        if (has_collided || !util_in_canvas_bound(n_x, n_y))
            bullets.splice(i, 1);
        ++i;
    });

    i = 0;
    enemies.forEach(enemy => {
        if (enemy.hp <= 0)
        {
            ++player.kills;
            enemies.splice(i, 1);
            return;
        }

        // Follow player
        const np = util_math_forward_towards(enemy, player, enemy.speed * ratio);

        // Check for bite
        let in_attack_dist = false;
        if (util_math_distance(enemy, player) < enemy.attack_radius)
        {
            in_attack_dist = true;
            if (enemy.confirm_bite == 0)
                enemy.confirm_bite = state.interval + ZOMBIE_BITE_CONFIRM_INTERVAL;
        }
        else
        {
            enemy.confirm_bite = 0;
        }

        if (in_attack_dist && state.interval > enemy.confirm_bite)
        {
            --player.hp;
            player.last_damage = state.interval;
            enemy.confirm_bite = state.interval + ZOMBIE_BITE_CONFIRM_INTERVAL * 2; // prevent damage stacking
        }

        // Dont 'swallow' the player by checking bound
        if (util_math_distance(np, player) < enemy.collission_radius)
            return;

        enemy.x = np.x;
        enemy.y = np.y;

        ++i;
    });
    
    if (state.interval > state.next_spawn && (ZOMBIE_MAX_SPAWN == -1 || enemies.length < ZOMBIE_MAX_SPAWN))
    {
        state.next_spawn = state.interval + ZOMBIE_SPAWN_INTERVAL;
        if (util_rand_num(0, 100) < ZOMBIE_SPAWN_CHANCE)
            return;

        const spawn_grave = graves[util_rand_num(0, graves.length)];
        util_spawn_enemy_zombie(spawn_grave.x, spawn_grave.y, util_rand_num(2, 6), util_rand_num(60, 150));
    }
};

let prev = Date.now();
const event_game_loop = () =>
{
    const now   = Date.now();
    const delta = now - prev;
    if (!state.pause)
    {
        state.interval += delta;
        event_update(delta / 1000);
    }

    event_render();
    prev = now;
    window.requestAnimationFrame(event_game_loop);
};

const PROGRESS_TOTAL = 23;
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

    addEventListener('keydown', (e) =>
    {
        if (state.fresh)
        {
            state.pause = false;
            state.fresh = false;
        }

        if (e.key == 'Escape')
        {
            state.pause = !state.pause;
            return;
        }

        state.keys[e.key] = true;
    });
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
        state.mouse.x = n_x;
        state.mouse.y = n_y;
    });

    // Check reso
    event_resize();

    player.sprites.base.onload = commit_progress;
    player.sprites.base.src = './assets/sprites/nanahi_base.png';

    player.sprites.eyes.onload = commit_progress;
    player.sprites.eyes.src = './assets/sprites/nanahi_eyes.png';

    player.sprites.arms.onload = commit_progress;
    player.sprites.arms.src = './assets/sprites/nanahi_arms.png';

    player.sprites.legs.idle.onload = commit_progress;
    player.sprites.legs.idle.src = './assets/sprites/nanahi_walk_idle.png';

    // TODO: should just loop this lol
    let leg_cycle0 = new Image();
    leg_cycle0.onload = commit_progress;
    leg_cycle0.src = './assets/sprites/nanahi_walk_0.png';
 
    let leg_cycle1 = new Image();
    leg_cycle1.onload = commit_progress;
    leg_cycle1.src = './assets/sprites/nanahi_walk_1.png';

    player.sprites.legs.cycle.push(leg_cycle0);
    player.sprites.legs.cycle.push(leg_cycle1);

    for (let i = 0; i < 3; ++i)
    {
        let hairband_cycle = new Image();
        hairband_cycle.onload = commit_progress;
        hairband_cycle.src = `./assets/sprites/nanahi_hairband_${i}.png`;
        player.sprites.hairband.cycle.push(hairband_cycle);
    }

    // a proper way to do a reverse cycle is to do math but..
    player.sprites.hairband.cycle.push(player.sprites.hairband.cycle[1]);

    for (let i = 0; i < 3; ++i)
    {
        let grave = new Image();
        grave.onload = commit_progress;
        grave.src = `./assets/sprites/grave_${i}.png`;
        state.resources.grave.sprites.push(grave);
    }


    player.sprites.hairband.idle.onload = commit_progress;
    player.sprites.hairband.idle.src = './assets/sprites/nanahi_hairband_idle.png';

    debug_weapon.sprite.onload = commit_progress;
    debug_weapon.sprite.src = './assets/sprites/test_weapon.png';

    debug_weapon.bullet_sprite.onload = commit_progress;
    debug_weapon.bullet_sprite.src = './assets/sprites/test_bullet.png';

    state.resources.dirt.sprite.onload = commit_progress;
    state.resources.dirt.sprite.src = './assets/sprites/dirt.png';

    state.resources.stone.sprite.onload = commit_progress;
    state.resources.stone.sprite.src = './assets/sprites/stone_wall.png';

    state.resources.bullet.sprite.onload = commit_progress;
    state.resources.bullet.sprite.src = './assets/sprites/generic_bullet.png';

    state.resources.dead.sprites.base.onload = commit_progress;
    state.resources.dead.sprites.base.src = './assets/sprites/dead_base.png';

    state.resources.dead.sprites.arm_l.onload = commit_progress;
    state.resources.dead.sprites.arm_l.src = './assets/sprites/dead_arm_l.png';

    state.resources.dead.sprites.arm_r.onload = commit_progress;
    state.resources.dead.sprites.arm_r.src = './assets/sprites/dead_arm_r.png';

    for (let i = 0; i < 2; ++i)
    {
        let legw = new Image();
        legw.onload = commit_progress;
        legw.src = `./assets/sprites/dead_walk_${i}.png`;
        state.resources.dead.sprites.walk_cycle.push(legw);
    }

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