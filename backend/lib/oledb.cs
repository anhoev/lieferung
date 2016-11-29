/*!
 * edge-oledb
 * Copyright(c) 2015 Brian Taber
 * MIT Licensed
 */

//#r "System.dll"
//#r "System.Data.dll"
//#r "System.Web.Extensions.dll"

using System;
using System.Data;
using System.Data.OleDb;
using System.Collections.Generic;
using System.Dynamic;
using System.Text;
using System.Threading.Tasks;


public class Startup
{
    OleDbConnection connection;
    string connectionString;    

    public async Task<object> Invoke(IDictionary<string, object> parameters)
    {
        string cmd = ((string)parameters["cmd"]);
        if (cmd.Equals("open"))
        {
            this.connectionString = ((string)parameters["dsn"]);
            if (!string.IsNullOrEmpty(connectionString))
            {
                try
                {
                    this.connection = new OleDbConnection(this.connectionString);
                    await connection.OpenAsync();
                }
                catch (Exception e)
                {
                    throw new Exception("init error", e);
                }
            }

            return null;
        }
        else if (cmd.Equals("close"))
        {
            connection.Close();
            return null;
        }
        else
        {
            string commandString = ((string)parameters["query"]);
            string command = commandString.Substring(0, 6).Trim().ToLower();
            switch (command)
            {
                case "select":
                    return await this.ExecuteQuery(commandString);
                    break;
                case "insert":
                case "update":
                case "delete":
                case "alter":
                    return await this.ExecuteNonQuery(commandString);
                    break;
                default:
                    throw new InvalidOperationException("Unsupported type of SQL command. Only select, insert, update, delete are supported.");
            }
        }

    }

    async Task<object> ExecuteQuery(string commandString)
    {
        try {
            using (var command = new OleDbCommand(commandString, connection))
            {

                List<object> rows = new List<object>();

                using (OleDbDataReader reader = command.ExecuteReader())
                {
                    IDataRecord record = (IDataRecord)reader;
                    while (await reader.ReadAsync())
                    {
                        var dataObject = new ExpandoObject() as IDictionary<string, Object>;
                        var resultRecord = new object[record.FieldCount];
                        record.GetValues(resultRecord);

                        for (int i = 0; i < record.FieldCount; i++)
                        {

                            Type type = record.GetFieldType(i);

                            if (resultRecord[i] is System.DBNull)
                            {
                                resultRecord[i] = null;
                            }
                            else if (type == typeof(byte[]) || type == typeof(char[]))
                            {
                                resultRecord[i] = Convert.ToBase64String((byte[])resultRecord[i]);
                            }
                            else if (type == typeof(DateTime))
                            {
                                resultRecord[i] = ((DateTime) resultRecord[i]).Add(new TimeSpan(-1,0,0));
                            }
                            else if (type == typeof(IDataReader))
                            {
                                resultRecord[i] = "<IDataReader>";
                            }
                            else if (type == typeof(decimal))
                            {
                                resultRecord[i] = Convert.ToDouble(resultRecord[i]);
                            }

                            dataObject.Add(record.GetName(i), resultRecord[i]);
                        }

                        rows.Add(dataObject);
                    }


                    return rows;
                }
            }
        }
        catch(Exception e)
        {
            throw new Exception("ExecuteQuery Error", e);
        }
    }

    async Task<object> ExecuteNonQuery(string commandString)
    {
        try
        {
            using (var command = new OleDbCommand(commandString, connection))
            {
                return await command.ExecuteNonQueryAsync();
            }
        }
        catch(Exception e)
        {
            throw new Exception("ExecuteNonQuery Error", e);
        }

    }
}
