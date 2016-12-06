### todo:

*   chan file Express
*   netsh interface portproxy add v4tov4 listenport=8000 connectport=8888 connectaddress=127.0.0.1 protocol=tcp
*   netsh interface portproxy reset
*   loc_0092DF38

    ```pass: 213819737111
    
    alter table Rechnungen alter column [ID] integer;
    alter table rechnungen drop constraint [pk_id_no];
    alter table rechnungen drop column [ID];
    alter table rechnungen add column [ID] counter (1,1);
    ALTER TABLE rechnungen ADD CONSTRAINT [pk_id_no] PRIMARY KEY ([ID]);
    
    
    UPDATE Artikel SET Modifikator = 1 WHERE Artikelgruppe = '6'
    UPDATE Artikel SET Preis6 = Preis1, Steuer6 = 7 WHERE Artikelgruppe = '1' or Artikelgruppe = '2' or Artikelgruppe = '3' or Artikelgruppe = '6'
    
    Alter table invoice alter column InvoiceId Autoincrement(1,1)```


*   local:

    ```C:\Users\Giang\AppData\Local\bonit.at_Software_OG```
    
    
    