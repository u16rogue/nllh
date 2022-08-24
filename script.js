const $ = (id, action = null) =>
{
    let obj = document.getElementById(id) ?? document.getElementsByClassName(id);
    if (obj == null)
        return null;

    if (action == null)
        return obj;
    return action(obj);
};

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

let canvas = {
    element : null,
    context : null
};

const event_resize = () => { $('topnav', (tn) => { $('resowarning', (rw) => { rw.style.display = (tn.offsetHeight == 100 ? 'none' : 'block'); }); }); }; // lol

// Remove JS alert and start load
$('jswarning', (d) =>
{
    d.remove();

    addEventListener('resize', event_resize);

    // Create canvas - http://www.lostdecadegames.com/how-to-make-a-simple-html5-canvas-game/ 
    canvas.element = document.createElement("canvas");
    canvas.context = canvas.element.getContext("2d");

    canvas.element.width  = CANVAS_WIDTH;
    canvas.element.height = CANVAS_HEIGHT;
    $('canvascont', (cc) => { cc.appendChild(canvas.element); });

    // Check reso
    event_resize();
});