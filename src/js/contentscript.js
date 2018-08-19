const main = async () => {
    await resetOldData();

    await getUserSettings();

    fixPage();
    setSelectors();

    if (!hasProjectionTable) return;

    addColumns();

    await assignDataFromStorage.run();

    setWatch.run();
    runGetAllData.run();
};

main();