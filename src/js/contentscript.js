const main = async () => {
    await getUserSettings();

    fixPage();

    if (!hasProjectionTable) return;

    setSelectors();
    addColumns();

    await assignDataFromStorage.run();

    doLeagueThings();
};

main();