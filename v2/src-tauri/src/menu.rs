//! The application menu: the things a Mac app is expected to offer from the
//! menu bar, with the accelerators a musician's hands already know. Every
//! item forwards its id to the webview, which does the actual work.

use tauri::menu::{AboutMetadata, Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Runtime};

pub const EVENT: &str = "quire://menu";

fn item<R: Runtime>(app: &AppHandle<R>, id: &str, label: &str, keys: &str) -> tauri::Result<tauri::menu::MenuItem<R>> {
    let builder = MenuItemBuilder::with_id(id, label);
    let builder = if keys.is_empty() { builder } else { builder.accelerator(keys) };
    builder.build(app)
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let about = AboutMetadata {
        name: Some("Quire".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        comments: Some("A practice journal for chords. A quire is a gathering of pages, folded and sewn; it sounds like choir.".into()),
        ..Default::default()
    };

    let app_menu = SubmenuBuilder::new(app, "Quire")
        .item(&PredefinedMenuItem::about(app, Some("About Quire"), Some(about))?)
        .separator()
        .item(&item(app, "sound", "Sound…", "CmdOrCtrl+,")?)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new", "New Progression", "CmdOrCtrl+N")?)
        .item(&item(app, "compose", "Compose…", "CmdOrCtrl+Shift+N")?)
        .separator()
        .item(&item(app, "save", "Save to Library", "CmdOrCtrl+S")?)
        .item(&item(app, "library", "Library…", "CmdOrCtrl+L")?)
        .separator()
        .item(&item(app, "export-midi", "Export MIDI…", "CmdOrCtrl+E")?)
        .item(&item(app, "copy-tab", "Copy Tab or Chart", "CmdOrCtrl+Shift+C")?)
        .separator()
        .close_window()
        .build()?;

    let edit = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .separator()
        .item(&item(app, "undo-spice", "Undo Last Spice", "CmdOrCtrl+Alt+Z")?)
        .build()?;

    let song = SubmenuBuilder::new(app, "Song")
        .item(&item(app, "play", "Play / Stop", "CmdOrCtrl+P")?)
        .separator()
        .item(&item(app, "spice", "Spice It Up", "CmdOrCtrl+Shift+S")?)
        .item(&item(app, "ab", "A/B the Last Spice", "CmdOrCtrl+Shift+A")?)
        .item(&item(app, "reset", "Reset to the Plain Progression", "CmdOrCtrl+Alt+R")?)
        .separator()
        .item(&item(app, "crab", "Let the Crab In", "CmdOrCtrl+Shift+K")?)
        .item(&item(app, "mirror", "Mirror the Chords", "CmdOrCtrl+Shift+M")?)
        .separator()
        .item(&item(app, "drums", "Drums", "CmdOrCtrl+Shift+D")?)
        .item(&item(app, "mute", "Mute", "CmdOrCtrl+Shift+U")?)
        .build()?;

    let view = SubmenuBuilder::new(app, "View")
        .item(&item(app, "view-learn", "Learn", "CmdOrCtrl+1")?)
        .item(&item(app, "view-jam", "Jam", "CmdOrCtrl+2")?)
        .item(&item(app, "view-write", "Write", "CmdOrCtrl+3")?)
        .separator()
        .item(&item(app, "instrument-guitar", "Guitar", "CmdOrCtrl+Alt+1")?)
        .item(&item(app, "instrument-bass", "Bass", "CmdOrCtrl+Alt+2")?)
        .item(&item(app, "instrument-piano", "Piano", "CmdOrCtrl+Alt+3")?)
        .item(&item(app, "instrument-op1", "OP-1", "CmdOrCtrl+Alt+4")?)
        .separator()
        .item(&item(app, "cover", "Inside Cover", "CmdOrCtrl+I")?)
        .separator()
        .fullscreen()
        .build()?;

    let window = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let help = SubmenuBuilder::new(app, "Help")
        .item(&item(app, "cover", "Quire Help", "")?)
        .build()?;

    Menu::with_items(app, &[&app_menu, &file, &edit, &song, &view, &window, &help])
}

/// Forward a menu choice to the page; the controller maps ids to actions.
pub fn forward<R: Runtime>(app: &AppHandle<R>, id: &str) {
    let _ = app.emit(EVENT, id.to_string());
}
