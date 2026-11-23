#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // Production releases alone are compiled with the trusted updater
    // public key and the narrowly-scoped updater capability.
    #[cfg(feature = "signed-updater")]
    let builder = builder.plugin(tauri_plugin_updater::Builder::new().build());

    builder
        .run(tauri::generate_context!())
        .expect("Não foi possível iniciar o FatiaLucro");
}
